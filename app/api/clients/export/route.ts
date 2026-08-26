import { NextRequest, NextResponse } from "next/server";
import { getContractor } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { requireFeature } from "@/lib/entitlements";
import { getClients } from "@/lib/queries";

export async function GET(request: NextRequest) {
  const contractor = await getContractor();
  const blocked = requireFeature(contractor.plan, "export_clients_csv");
  if (blocked) {
    const url = request.nextUrl.clone();
    url.pathname = "/app/clients";
    url.search = "?upgrade=export";
    return NextResponse.redirect(url);
  }

  const rows = await getClients();
  const csv = toCsv(
    ["Name", "Email", "Phone", "Billing address"],
    rows.map((client) => [client.name, client.email, client.phone, client.billingAddress]),
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clients-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
