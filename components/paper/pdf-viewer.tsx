"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PAPERS_BUCKET, getPaperMetadataLabel, type Paper } from "@/lib/papers";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  RenderTask,
  TextLayer
} from "pdfjs-dist";

type PdfJsModule = typeof import("pdfjs-dist");
type LoadState = "finalizing" | "loading" | "ready" | "error";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;
const MAX_DEVICE_PIXEL_RATIO = 2;
const VIEWER_HORIZONTAL_PADDING = 32;
const SCROLL_ANCHOR_OFFSET_PX = 64;

let pdfjsPromise: Promise<PdfJsModule> | null = null;

interface PdfViewerProps {
  paper: Paper;
  onClose: () => void;
}

interface ViewerStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

interface PdfPageCanvasProps {
  document: PDFDocumentProxy;
  pageNumber: number;
  viewportWidth: number;
  zoom: number;
  registerPage: (pageNumber: number, element: HTMLDivElement | null) => void;
  onPageLayoutChange: (pageNumber: number) => void;
}

interface ScrollAnchor {
  pageNumber: number;
  offsetRatio: number;
}

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();

      return pdfjs;
    });
  }

  return pdfjsPromise;
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));
}

function clampRatio(value: number) {
  return Math.min(1, Math.max(0, value));
}

function isCanceledRender(error: unknown) {
  return error instanceof Error && error.name === "RenderingCancelledException";
}

function normalizePdfSelectionText(text: string) {
  return text
    .normalize("NFKC")
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\u00AD/g, "")
    .replace(/(\p{L})-\s*[\r\n]+\s*(\p{L})/gu, "$1$2")
    .replace(/[ \t\f\v]*[\r\n]+[ \t\f\v]*/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .trim();
}

function selectionIntersectsPdfTextLayer(selection: Selection, viewer: HTMLElement) {
  if (selection.isCollapsed || selection.rangeCount === 0) return false;

  const textLayers = viewer.querySelectorAll(".pdf-text-layer");

  for (let rangeIndex = 0; rangeIndex < selection.rangeCount; rangeIndex += 1) {
    const range = selection.getRangeAt(rangeIndex);

    for (const textLayer of textLayers) {
      try {
        if (range.intersectsNode(textLayer)) return true;
      } catch {
        continue;
      }
    }
  }

  return false;
}

function ViewerState({ icon, title, description, action }: ViewerStateProps) {
  return (
    <div className="flex h-full w-full items-center justify-center p-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-3">
        <div className="text-muted-foreground">{icon}</div>
        <div className="space-y-1">
          <p className="text-sm font-medium">{title}</p>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

function PdfPageCanvas({
  document,
  pageNumber,
  viewportWidth,
  zoom,
  registerPage,
  onPageLayoutChange
}: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const textLayerElement = textLayerRef.current;
    if (!canvas || !textLayerElement || viewportWidth <= 0) return;

    let isActive = true;
    let renderTask: RenderTask | null = null;
    let textLayer: TextLayer | null = null;

    setIsRendering(true);
    setError(null);
    textLayerElement.innerHTML = "";

    const renderPage = async () => {
      const pdfjs = await loadPdfjs();
      const page = await document.getPage(pageNumber);
      if (!isActive) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = viewportWidth / baseViewport.width;
      const renderScale = fitScale * zoom;
      const viewport = page.getViewport({ scale: renderScale });
      const devicePixelRatio = Math.min(
        window.devicePixelRatio || 1,
        MAX_DEVICE_PIXEL_RATIO
      );
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Could not create canvas context.");
      }

      canvas.width = Math.floor(viewport.width * devicePixelRatio);
      canvas.height = Math.floor(viewport.height * devicePixelRatio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      textLayerElement.innerHTML = "";
      textLayerElement.style.setProperty("--total-scale-factor", `${viewport.scale}`);
      textLayerElement.style.setProperty("--scale-round-x", "1px");
      textLayerElement.style.setProperty("--scale-round-y", "1px");
      textLayerElement.style.width = `${Math.floor(viewport.width)}px`;
      textLayerElement.style.height = `${Math.floor(viewport.height)}px`;
      setPageSize({
        width: Math.floor(viewport.width),
        height: Math.floor(viewport.height)
      });

      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform:
          devicePixelRatio === 1
            ? undefined
            : [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0]
      });
      textLayer = new pdfjs.TextLayer({
        textContentSource: page.streamTextContent({
          includeMarkedContent: true
        }),
        container: textLayerElement,
        viewport
      });

      await Promise.all([renderTask.promise, textLayer.render()]);

      if (isActive) {
        setIsRendering(false);
      }
    };

    renderPage().catch((renderError: unknown) => {
      if (!isActive || isCanceledRender(renderError)) return;

      setError(
        renderError instanceof Error ? renderError.message : "Could not render this page."
      );
      setIsRendering(false);
    });

    return () => {
      isActive = false;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [document, pageNumber, viewportWidth, zoom]);

  useEffect(() => {
    if (!pageSize) return;
    onPageLayoutChange(pageNumber);
  }, [onPageLayoutChange, pageNumber, pageSize]);

  const placeholderHeight = pageSize?.height ?? 420;

  return (
    <div
      ref={(element) => registerPage(pageNumber, element)}
      data-page-number={pageNumber}
      className="flex w-full justify-center"
    >
      <div
        className="relative border border-border bg-background shadow-sm"
        style={{
          width: pageSize?.width,
          minHeight: placeholderHeight
        }}
      >
        {isRendering && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <p className="max-w-xs text-sm text-muted-foreground">{error}</p>
          </div>
        )}

        <canvas
          ref={canvasRef}
          aria-label={`Page ${pageNumber}`}
          className={cn("block max-w-full", (isRendering || error) && "opacity-0")}
        />
        <div
          ref={textLayerRef}
          aria-hidden="true"
          className={cn(
            "pdf-text-layer textLayer absolute inset-0",
            (isRendering || error) && "opacity-0"
          )}
        />
      </div>
    </div>
  );
}

export function PdfViewer({ paper, onClose }: PdfViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const pageElementsRef = useRef(new Map<number, HTMLDivElement>());
  const pendingZoomAnchorRef = useRef<ScrollAnchor | null>(null);
  const zoomRestoreFrameRef = useRef<number | null>(null);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [loadState, setLoadState] = useState<LoadState>(
    paper.status === "ready" ? "loading" : "finalizing"
  );
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const pageCount = pdfDocument?.numPages ?? 0;
  const pageNumbers = useMemo(
    () => Array.from({ length: pageCount }, (_, index) => index + 1),
    [pageCount]
  );
  const zoomPercent = Math.round(zoom * 100);

  const clearPdfDocument = useCallback(() => {
    const currentLoadingTask = loadingTaskRef.current;

    loadingTaskRef.current = null;
    pdfDocumentRef.current = null;
    pageElementsRef.current.clear();
    pendingZoomAnchorRef.current = null;

    if (zoomRestoreFrameRef.current !== null) {
      window.cancelAnimationFrame(zoomRestoreFrameRef.current);
      zoomRestoreFrameRef.current = null;
    }

    setPdfDocument(null);
    setCurrentPage(1);

    if (currentLoadingTask) {
      void currentLoadingTask.destroy();
    }
  }, []);

  const registerPage = useCallback(
    (pageNumber: number, element: HTMLDivElement | null) => {
      if (element) {
        pageElementsRef.current.set(pageNumber, element);
      } else {
        pageElementsRef.current.delete(pageNumber);
      }
    },
    []
  );

  const scrollToPage = useCallback((pageNumber: number, behavior: ScrollBehavior = "smooth") => {
    const pageElement = pageElementsRef.current.get(pageNumber);
    if (!pageElement) return;

    pageElement.scrollIntoView({
      block: "start",
      behavior
    });
    setCurrentPage(pageNumber);
  }, []);

  const getReadingLineOffset = useCallback((container: HTMLDivElement) => {
    return Math.min(SCROLL_ANCHOR_OFFSET_PX, Math.max(0, container.clientHeight / 3));
  }, []);

  const getScrollAnchor = useCallback((): ScrollAnchor | null => {
    const container = scrollContainerRef.current;
    if (!container) return null;

    const containerRect = container.getBoundingClientRect();
    const readingLineY = containerRect.top + getReadingLineOffset(container);
    let nearestAnchor: ScrollAnchor | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    [...pageElementsRef.current.entries()]
      .sort(([pageA], [pageB]) => pageA - pageB)
      .forEach(([pageNumber, element]) => {
        const rect = element.getBoundingClientRect();
        if (rect.height <= 0) return;

        if (readingLineY >= rect.top && readingLineY <= rect.bottom) {
          nearestAnchor = {
            pageNumber,
            offsetRatio: clampRatio((readingLineY - rect.top) / rect.height)
          };
          nearestDistance = 0;
          return;
        }

        const distance =
          readingLineY < rect.top ? rect.top - readingLineY : readingLineY - rect.bottom;

        if (distance < nearestDistance) {
          nearestAnchor = {
            pageNumber,
            offsetRatio: readingLineY < rect.top ? 0 : 1
          };
          nearestDistance = distance;
        }
      });

    return nearestAnchor;
  }, [getReadingLineOffset]);

  const restoreScrollAnchor = useCallback(
    (anchor: ScrollAnchor) => {
      const container = scrollContainerRef.current;
      const pageElement = pageElementsRef.current.get(anchor.pageNumber);
      if (!container || !pageElement) return;

      const containerRect = container.getBoundingClientRect();
      const pageRect = pageElement.getBoundingClientRect();
      const readingLineOffset = getReadingLineOffset(container);
      const pageTopInScrollContent = container.scrollTop + pageRect.top - containerRect.top;
      const nextScrollTop =
        pageTopInScrollContent + pageRect.height * anchor.offsetRatio - readingLineOffset;

      container.scrollTo({
        top: Math.max(0, nextScrollTop),
        behavior: "auto"
      });
      setCurrentPage(anchor.pageNumber);
    },
    [getReadingLineOffset]
  );

  const handlePageLayoutChange = useCallback(
    (pageNumber: number) => {
      const anchor = pendingZoomAnchorRef.current;
      if (!anchor || anchor.pageNumber !== pageNumber || loadState !== "ready") return;

      if (zoomRestoreFrameRef.current !== null) {
        window.cancelAnimationFrame(zoomRestoreFrameRef.current);
      }

      zoomRestoreFrameRef.current = window.requestAnimationFrame(() => {
        restoreScrollAnchor(anchor);
        pendingZoomAnchorRef.current = null;
        zoomRestoreFrameRef.current = null;
      });
    },
    [loadState, restoreScrollAnchor]
  );

  const updateZoomWithAnchor = useCallback(
    (getNextZoom: (currentZoom: number) => number) => {
      const anchor = getScrollAnchor();

      setZoom((currentZoom) => {
        const nextZoom = getNextZoom(currentZoom);

        if (nextZoom === currentZoom) {
          pendingZoomAnchorRef.current = null;
          return currentZoom;
        }

        pendingZoomAnchorRef.current = anchor;
        return nextZoom;
      });
    },
    [getScrollAnchor]
  );

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateViewportWidth = () => {
      setViewportWidth(
        Math.max(280, container.clientWidth - VIEWER_HORIZONTAL_PADDING)
      );
    };

    updateViewportWidth();

    const resizeObserver = new ResizeObserver(updateViewportWidth);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (paper.status !== "ready") {
      clearPdfDocument();
      setLoadState("finalizing");
      setError(null);
      return;
    }

    let isActive = true;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    let loadedDocument: PDFDocumentProxy | null = null;

    clearPdfDocument();
    setLoadState("loading");
    setError(null);

    const loadDocument = async () => {
      const supabase = getBrowserSupabaseClient();
      const { data, error: downloadError } = await supabase.storage
        .from(PAPERS_BUCKET)
        .download(paper.storage_path);

      if (!isActive) return;

      if (downloadError || !data) {
        throw new Error(downloadError?.message || "Could not load this PDF.");
      }

      const pdfjs = await loadPdfjs();
      const arrayBuffer = await data.arrayBuffer();

      if (!isActive) return;

      loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      loadingTaskRef.current = loadingTask;
      loadedDocument = await loadingTask.promise;

      if (!isActive) {
        await loadingTask.destroy();
        return;
      }

      pdfDocumentRef.current = loadedDocument;
      setPdfDocument(loadedDocument);
      setCurrentPage(1);
      setZoom(1);
      setLoadState("ready");
    };

    loadDocument().catch((loadError: unknown) => {
      if (!isActive) return;

      setError(loadError instanceof Error ? loadError.message : "Could not load this PDF.");
      setLoadState("error");
    });

    return () => {
      isActive = false;
      if (loadingTask && loadingTask !== loadingTaskRef.current) {
        void loadingTask.destroy();
      }
    };
  }, [clearPdfDocument, paper.status, paper.storage_path, reloadKey]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || pageCount === 0) return;

    const visiblePages = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageNumber = Number(
            (entry.target as HTMLElement).dataset.pageNumber
          );

          if (!pageNumber) return;

          if (entry.isIntersecting) {
            visiblePages.set(pageNumber, entry.intersectionRatio);
          } else {
            visiblePages.delete(pageNumber);
          }
        });

        if (visiblePages.size === 0) return;

        const nextPage = [...visiblePages.entries()].sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1];
          return a[0] - b[0];
        })[0][0];

        setCurrentPage(nextPage);
      },
      {
        root: container,
        threshold: [0.1, 0.25, 0.5, 0.75, 1]
      }
    );

    pageElementsRef.current.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [pageCount]);

  useEffect(() => {
    return () => clearPdfDocument();
  }, [clearPdfDocument]);

  useEffect(() => {
    const handleCopy = (event: ClipboardEvent) => {
      const viewer = viewerRef.current;
      const selection = document.getSelection();

      if (
        !viewer ||
        !selection ||
        !event.clipboardData ||
        !selectionIntersectsPdfTextLayer(selection, viewer)
      ) {
        return;
      }

      const normalizedText = normalizePdfSelectionText(selection.toString());
      if (!normalizedText) return;

      event.clipboardData.setData("text/plain", normalizedText);
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("copy", handleCopy, true);

    return () => {
      document.removeEventListener("copy", handleCopy, true);
    };
  }, []);

  const handleZoomOut = () =>
    updateZoomWithAnchor((currentZoom) => clampZoom(currentZoom - ZOOM_STEP));
  const handleZoomIn = () =>
    updateZoomWithAnchor((currentZoom) => clampZoom(currentZoom + ZOOM_STEP));
  const handleResetZoom = () => updateZoomWithAnchor(() => 1);
  const handlePreviousPage = () => scrollToPage(Math.max(1, currentPage - 1));
  const handleNextPage = () => scrollToPage(Math.min(pageCount, currentPage + 1));

  return (
    <div ref={viewerRef} className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{paper.title}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {getPaperMetadataLabel(paper)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={loadState !== "ready" || currentPage <= 1}
            onClick={handlePreviousPage}
            aria-label="Previous page"
            title="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-8 min-w-[76px] items-center justify-center text-xs text-muted-foreground">
            {loadState === "ready" ? `${currentPage} / ${pageCount}` : "-- / --"}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={loadState !== "ready" || currentPage >= pageCount}
            onClick={handleNextPage}
            aria-label="Next page"
            title="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="mx-1 h-5 w-px bg-border" />

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={loadState !== "ready" || zoom <= MIN_ZOOM}
            onClick={handleZoomOut}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <div className="flex h-8 min-w-[48px] items-center justify-center text-xs text-muted-foreground">
            {loadState === "ready" ? `${zoomPercent}%` : "--"}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={loadState !== "ready" || zoom >= MAX_ZOOM}
            onClick={handleZoomIn}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={loadState !== "ready" || zoom === 1}
            onClick={handleResetZoom}
            aria-label="Reset zoom to fit width"
            title="Reset zoom to fit width"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>

          <div className="mx-1 h-5 w-px bg-border" />

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            aria-label="Close paper"
            title="Close paper"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto bg-muted/40 p-4">
        {loadState === "finalizing" && (
          <ViewerState
            icon={<Loader2 className="h-5 w-5 animate-spin" />}
            title="Finalizing upload..."
          />
        )}

        {loadState === "loading" && (
          <ViewerState
            icon={<Loader2 className="h-5 w-5 animate-spin" />}
            title="Loading PDF..."
          />
        )}

        {loadState === "error" && (
          <ViewerState
            icon={<AlertCircle className="h-5 w-5" />}
            title="Could not load PDF"
            description={error ?? "Try loading the paper again."}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                Try again
              </Button>
            }
          />
        )}

        {loadState === "ready" && pdfDocument && (
          <div className="mx-auto flex w-full flex-col items-center gap-5">
            {pageNumbers.map((pageNumber) => (
              <PdfPageCanvas
                key={`${paper.id}-${pageNumber}`}
                document={pdfDocument}
                pageNumber={pageNumber}
                viewportWidth={viewportWidth}
                zoom={zoom}
                registerPage={registerPage}
                onPageLayoutChange={handlePageLayoutChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
