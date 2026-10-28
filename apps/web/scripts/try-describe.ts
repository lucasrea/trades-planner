#!/usr/bin/env npx tsx
import { runDescribeExtraction } from "../lib/ai/run-describe";

const text = process.argv.slice(2).join(" ").trim();
if (!text) {
  console.error('Usage: npx tsx scripts/try-describe.ts "<description text>"');
  process.exit(1);
}

process.env.AI_PROVIDER = process.env.AI_PROVIDER ?? "live";

async function main() {
  const result = await runDescribeExtraction({
    text,
    context: { labourRate: 85, clients: [{ id: "c1", name: "Patel, Maria" }], openJobs: [] },
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
