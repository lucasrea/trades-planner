import type { DescribeExtraction } from "@/lib/ai/extraction-types";
import { createFakeExtractionProvider, readFakeMode } from "@/lib/ai/fake";
import type { PlanLoopClient, PlanToolCall } from "@/lib/ai/plan-loop";
import { ProviderError } from "@/lib/ai/provider";
import { classifyPlanMessage } from "@/lib/plan-message";

const HOURS = /(\d+(?:\.\d+)?)\s+hours?\s+of\s+(?:labour|labor)/i;
const AND_MATERIAL = /\b(?:and|plus)\s+(?:an?\s+|the\s+)?([a-z][a-z\s]{1,40}?)\s+at\s+\$?(\d+(?:\.\d+)?)/i;

function messageText(content: string | null) {
  const text = content ?? "";
  const marker = "Message:\n";
  const at = text.lastIndexOf(marker);
  return (at >= 0 ? text.slice(at + marker.length) : text).trim();
}

function proposeCall(id: string, extraction: DescribeExtraction): PlanToolCall {
  return {
    id,
    name: "propose",
    arguments: JSON.stringify({
      intent: extraction.intent,
      job_title: extraction.job_title,
      client_name: extraction.client_name,
      site_address: extraction.site_address,
      notes: extraction.scope_notes,
      lines: extraction.lines.map((line) => ({
        kind: line.kind,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unit_price: line.unit_price,
      })),
    }),
  };
}

/** Two proposes when the fake text clearly asks for hours and a priced material. */
export function fakeMixedProposes(text: string): PlanToolCall[] | null {
  const hours = HOURS.exec(text);
  const material = AND_MATERIAL.exec(text);
  if (!hours || !material) return null;
  return [
    proposeCall("propose-hours", {
      intent: "log",
      client_name: null,
      job_title: null,
      site_address: null,
      scope_notes: null,
      warnings: [],
      lines: [{ kind: "labour", description: "Labour", quantity: Number(hours[1]), unit: "hr", unit_price: null }],
    }),
    proposeCall("propose-material", {
      intent: "log",
      client_name: null,
      job_title: null,
      site_address: null,
      scope_notes: null,
      warnings: [],
      lines: [
        {
          kind: "material",
          description: material[1]!.trim(),
          quantity: 1,
          unit: "ea",
          unit_price: Number(material[2]),
        },
      ],
    }),
  ];
}

function readCount(content: string | null) {
  try {
    const value = JSON.parse(content ?? "") as { count?: unknown };
    return typeof value.count === "number" ? value.count : null;
  } catch {
    return null;
  }
}

/** Scripted stand-in for the tool loop. One propose, or two when the sentence asks for both. */
export function createFakePlanClient(): PlanLoopClient {
  const fake = createFakeExtractionProvider();
  return {
    async complete(messages) {
      const lastTool = [...messages].reverse().find((message) => message.role === "tool");
      if (lastTool) {
        // After a find, answer with the count the tool returned. After a card, stop.
        const found = readCount(lastTool.content);
        return { content: found == null ? null : `You have ${found} matching.`, toolCalls: [] };
      }
      const mode = readFakeMode();
      if (mode === "error" || mode === "malformed") throw new ProviderError("Fake provider error.");
      const text = messageText([...messages].reverse().find((message) => message.role === "user")?.content ?? null);
      if (classifyPlanMessage(text) === "question") {
        const type = /\binvoice/i.test(text) ? "invoice" : /\bquote/i.test(text) ? "quote" : undefined;
        const status = /\bopen\b/i.test(text) ? "open" : /\boverdue\b/i.test(text) ? "overdue" : /\bunpaid|owe/i.test(text) ? "unpaid" : undefined;
        return { content: null, toolCalls: [{ id: "find-1", name: "find_documents", arguments: JSON.stringify({ doc_type: type, status }) }] };
      }
      const mixed = fakeMixedProposes(text);
      if (mixed) return { content: null, toolCalls: mixed };
      const extraction = await fake.extractDescribe({
        text,
        context: { labourRate: 85, clients: [], openJobs: [] },
      });
      return { content: null, toolCalls: [proposeCall("propose-1", extraction)] };
    },
  };
}
