/**
 * Detect whether the contractor named a dollar amount in the message. Pure: no I/O.
 */
import { roundMoney } from "@/lib/money";

const DOLLAR_SIGN = /\$\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*\$/;
const DOLLARS_WORD = /\d+(?:\.\d+)?\s+dollars?\b/i;
const AT_PRICE = /\bat\s+(\d+(?:\.\d+)?)(?:\s+(\S+))?/gi;
const TIME_UNIT = /^(?:hours?|hrs?|hr)\b/i;
const NUMBER_TOKEN = /\$?\s*\d{1,3}(?:,\d{3})+(?:\.\d+)?|\$?\s*\d+(?:\.\d+)?/g;

export const UNSAID_PRICE = "This price was not in what you said.";

const LABOUR_PRICE =
  /(?:\b(?:hours?|hrs?|labour|labor)\b(?:\s+\w+){0,2}\s+at\s+\$?\d)|(?:\bat\s+\$?\d+(?:\.\d+)?(?:\s+dollars?)?(?:\s+\w+){0,2}\s+(?:an?\s+)?(?:hours?|hrs?|labour|labor)\b)|(?:\$\s*\d+(?:\.\d+)?\s+(?:an?\s+)?(?:hours?|hrs?|labour|labor)\b)/i;

/** A price named for the labour itself. A material price in the same message does not count. */
export function transcriptNamesLabourPrice(transcript: string | null | undefined): boolean {
  return LABOUR_PRICE.test(transcript ?? "");
}

export function transcriptNamesPrice(transcript: string | null | undefined): boolean {
  const text = transcript?.trim();
  if (!text) return false;
  if (DOLLAR_SIGN.test(text)) return true;
  if (DOLLARS_WORD.test(text)) return true;
  for (const match of text.matchAll(AT_PRICE)) {
    const following = match[2]?.toLowerCase();
    if (following && TIME_UNIT.test(following)) continue;
    return true;
  }
  return false;
}

/** True when the digits of this price appear in the message ($45, 45, 45.00, 1,265.60). */
export function priceAppearsInTranscript(transcript: string | null | undefined, price: number): boolean {
  const text = transcript ?? "";
  if (!text.trim() || !Number.isFinite(price)) return false;
  const target = roundMoney(price);
  for (const match of text.matchAll(NUMBER_TOKEN)) {
    const value = Number(match[0].replace(/[$,\s]/g, ""));
    if (Number.isFinite(value) && Math.abs(roundMoney(value) - target) <= 0.001) return true;
  }
  return false;
}
