import { createLiveExtractionProvider } from "@/lib/ai/extract-describe";
import type { DescribeExtraction, ReceiptExtraction } from "@/lib/ai/extraction-types";
import { ProviderError, type ExtractionProvider, type TranscriptionProvider } from "@/lib/ai/provider";

export type FakeMode = "ok" | "slow" | "error" | "malformed" | "empty";

const DEFAULT_DESCRIBE: DescribeExtraction = {
  intent: "quote",
  client_name: "Patel",
  job_title: "Water heater replacement",
  site_address: "14 Elm Street",
  scope_notes: "Replace tank and fittings.",
  lines: [
    { kind: "labour", description: "Install and connect", quantity: 4, unit: "hr", unit_price: null },
    { kind: "material", description: "Water heater tank", quantity: 1, unit: "ea", unit_price: 780 },
  ],
  warnings: [],
};

const DEFAULT_RECEIPT: ReceiptExtraction = {
  vendor: "Home Depot",
  purchased_at: "2026-10-01",
  currency: "CAD",
  subtotal: 45,
  tax: 5.85,
  total: 50.85,
  lines: [{ description: "PEX fittings", quantity: 1, unit_price: 45, line_total: 45 }],
  warnings: [],
};

function hashKey(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) | 0;
  return String(h);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function readFakeMode(): FakeMode {
  const raw = process.env.AI_FAKE_MODE ?? "ok";
  if (raw === "ok" || raw === "slow" || raw === "error" || raw === "malformed" || raw === "empty") return raw;
  return "ok";
}

export function readFakeDelayMs() {
  const n = Number(process.env.AI_FAKE_DELAY_MS ?? 3000);
  return Number.isFinite(n) && n >= 0 ? n : 3000;
}

async function runFake<T>(produce: () => T): Promise<T> {
  const mode = readFakeMode();
  if (mode === "slow") await delay(readFakeDelayMs());
  if (mode === "error") throw new ProviderError("Fake provider error.");
  if (mode === "malformed") throw new SyntaxError("Unexpected token in fake JSON");
  if (mode === "empty") return produce();
  return produce();
}

export function createFakeExtractionProvider(): ExtractionProvider {
  return {
    async extractDescribe({ text }) {
      return runFake(() => {
        if (readFakeMode() === "empty") {
          return { ...DEFAULT_DESCRIBE, lines: [], warnings: ["No lines detected."] };
        }
        const key = hashKey(text.trim().slice(0, 200));
        if (key.endsWith("7")) {
          return { ...DEFAULT_DESCRIBE, intent: "invoice", client_name: "Chen" };
        }
        return { ...DEFAULT_DESCRIBE, scope_notes: text.slice(0, 120) || DEFAULT_DESCRIBE.scope_notes };
      });
    },
    async extractReceipt({ imageBytes, mimeType }) {
      return runFake(() => {
        if (readFakeMode() === "empty") {
          return { ...DEFAULT_RECEIPT, lines: [], warnings: ["Receipt unreadable."] };
        }
        const key = hashKey(`${mimeType}:${imageBytes.byteLength}`);
        return { ...DEFAULT_RECEIPT, vendor: key.endsWith("3") ? "Supply Co" : DEFAULT_RECEIPT.vendor };
      });
    },
  };
}

export function createFakeTranscriptionProvider(): TranscriptionProvider {
  return {
    async transcribe({ audioBytes, mimeType }) {
      return runFake(() => {
        if (readFakeMode() === "empty") return "";
        return `Fake transcript (${mimeType}, ${audioBytes.byteLength} bytes). Quote for Patel, four hours labour and a seven hundred eighty dollar tank.`;
      });
    },
  };
}

export function assertLiveProviderAllowed() {
  if (process.env.AI_PROVIDER !== "live") return;
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) {
    throw new ProviderError("AI_PROVIDER=live requires OPENAI_API_KEY.");
  }
}

export function getExtractionProvider(): ExtractionProvider {
  const provider = process.env.AI_PROVIDER ?? (process.env.NODE_ENV === "production" ? "live" : "fake");
  if (provider === "live") {
    assertLiveProviderAllowed();
    return createLiveExtractionProvider();
  }
  return createFakeExtractionProvider();
}

export function getTranscriptionProvider(): TranscriptionProvider {
  const provider = process.env.AI_PROVIDER ?? (process.env.NODE_ENV === "production" ? "live" : "fake");
  if (provider === "live") {
    assertLiveProviderAllowed();
    throw new ProviderError("Live transcription provider is not implemented yet.");
  }
  return createFakeTranscriptionProvider();
}
