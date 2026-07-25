import { customAlphabet } from "nanoid";
import type { KnowledgeDoc } from "./types";

const id = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);

export const KB_MAX_FILE_SIZE = 1_000_000;
export const KB_MAX_TEXT = 200_000;

export const KB_TEXT_TYPES = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
] as const;

export const KB_BINARY_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
] as const;

export function isClientSideExtractable(mime: string, fileName: string): boolean {
  if (KB_TEXT_TYPES.includes(mime as (typeof KB_TEXT_TYPES)[number])) return true;
  return /\.(md|markdown|txt|csv|json)$/i.test(fileName);
}

export function isServerSideExtractable(mime: string, fileName: string): boolean {
  if (KB_BINARY_TYPES.includes(mime as (typeof KB_BINARY_TYPES)[number])) return true;
  return /\.(pdf|docx)$/i.test(fileName);
}

export async function extractTextClient(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function makeKnowledgeDoc(
  fileName: string,
  mimeType: string,
  content: string,
): KnowledgeDoc {
  const trimmed = content.length > KB_MAX_TEXT ? content.slice(0, KB_MAX_TEXT) : content;
  return {
    id: id(),
    fileName,
    mimeType,
    content: trimmed,
    charCount: trimmed.length,
    addedAt: new Date().toISOString(),
  };
}
