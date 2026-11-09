/**
 * Detect whether the contractor named a dollar amount in the message. Pure: no I/O.
 */

const DOLLAR_SIGN = /\$\s*\d+(?:\.\d+)?/;
const DOLLARS_WORD = /\d+(?:\.\d+)?\s+dollars?\b/i;
const AT_PRICE = /\bat\s+(\d+(?:\.\d+)?)(?:\s+(\S+))?/gi;
const TIME_UNIT = /^(?:hours?|hrs?|hr)\b/i;

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
