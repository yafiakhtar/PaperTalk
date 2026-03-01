import { getOpenAI } from "./openai";
import { getEnv } from "./env";

export async function extractTextWithOpenAI(buffer: ArrayBuffer) {
  const env = getEnv();
  const openai = getOpenAI();
  const base64 = Buffer.from(buffer).toString("base64");
  const response = await openai.responses.create({
    model: env.OPENAI_OCR_MODEL,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_file",
            filename: "document.pdf",
            file_data: `data:application/pdf;base64,${base64}`
          },
          {
            type: "input_text",
            text: "Extract the full text from this PDF. Preserve section headings and include page numbers in the form [page: N] before each page's text."
          }
        ]
      }
    ]
  });

  return response.output_text ?? "";
}
