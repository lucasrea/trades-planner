import { NextResponse } from "next/server";
import { getContractor } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { getClients } from "@/lib/queries";

export async function GET() {
  await getContractor();
  const rows = await getClients();
  const stamp = new Date().toISOString().slice(0, 10);
  const csv = toCsv(
    ["Name", "Email", "Phone", "Billing address"],
    rows.map((c) => [c.name, c.email, c.phone, c.billingAddress]),
  );
  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clients-${stamp}.csv"`,
    },
  });
}
