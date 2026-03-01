import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireAuth } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { uploadPdf } from "@/lib/blob";
import { getSupabaseAdmin } from "@/lib/supabase";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request);
  const limit = rateLimit(`upload:${ip}`, 10, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "File required" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files supported" }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const blob = await uploadPdf(`${crypto.randomUUID()}.pdf`, buffer);

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("documents")
    .insert({
      title: file.name,
      blob_url: blob.url,
      status: "uploaded"
    })
    .select("id, title, blob_url, status")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ document: data });
}
