import type { DescribeExtraction, ReceiptExtraction } from "@/lib/ai/extraction-types";

export type DescribeContext = {
  labourRate: number;
  openJobs: { id: string; title: string; clientName: string }[];
  clients: { id: string; name: string }[];
};

export type ExtractionProvider = {
  extractDescribe(input: { text: string; context: DescribeContext }): Promise<DescribeExtraction>;
  extractReceipt(input: { imageBytes: Uint8Array; mimeType: string }): Promise<ReceiptExtraction>;
};

export type TranscriptionProvider = {
  transcribe(input: { audioBytes: Uint8Array; mimeType: string }): Promise<string>;
};

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}
