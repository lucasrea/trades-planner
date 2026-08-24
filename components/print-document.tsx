import { cad, computeTotals, type DraftLine } from "@/lib/money";

type Party = {
  businessName: string;
  businessAddress: string;
  phone: string;
  email: string;
  gstHstNumber: string;
  taxLabel: string;
  taxRate: number;
  etransferEmail: string;
  etransferNote: string;
};

export function PrintDocument({
  kind,
  number,
  clientName,
  clientAddress,
  siteAddress,
  notes,
  dateLabel,
  dateValue,
  lines,
  contractor,
}: {
  kind: "Quote" | "Invoice";
  number: string;
  clientName: string;
  clientAddress?: string;
  siteAddress?: string;
  notes?: string;
  dateLabel: string;
  dateValue?: string | null;
  lines: DraftLine[];
  contractor: Party;
}) {
  const totals = computeTotals(lines, contractor.taxRate);
  return (
    <div className="mx-auto max-w-3xl bg-white p-10 text-black print:max-w-none print:p-0">
      <div className="flex items-start justify-between gap-8">
        <div>
          <p className="text-2xl font-semibold">{contractor.businessName || "Your business"}</p>
          <p className="mt-2 whitespace-pre-line text-sm text-stone-600">{contractor.businessAddress}</p>
          <p className="text-sm text-stone-600">
            {contractor.phone}
            {contractor.phone && contractor.email ? " · " : ""}
            {contractor.email}
          </p>
          {contractor.gstHstNumber ? (
            <p className="mt-1 text-sm">GST/HST {contractor.gstHstNumber}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-sm uppercase tracking-wide text-stone-500">{kind}</p>
          <p className="text-2xl font-semibold">{number}</p>
          {dateValue ? (
            <p className="mt-2 text-sm">
              {dateLabel}: {dateValue}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-500">Bill to</p>
          <p className="mt-1 font-medium">{clientName}</p>
          {clientAddress ? <p className="whitespace-pre-line text-sm text-stone-600">{clientAddress}</p> : null}
        </div>
        {siteAddress ? (
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-500">Job site</p>
            <p className="mt-1 whitespace-pre-line text-sm">{siteAddress}</p>
          </div>
        ) : null}
      </div>
      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-stone-300 text-left">
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 font-medium">Qty</th>
            <th className="py-2 font-medium">Price</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-b border-stone-200">
              <td className="py-2">
                <span className="mr-2 text-xs uppercase text-stone-500">{line.kind}</span>
                {line.description}
              </td>
              <td className="py-2">
                {line.quantity} {line.unit}
              </td>
              <td className="py-2">{cad(line.unitPrice)}</td>
              <td className="py-2 text-right">{cad(line.quantity * line.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-6 ml-auto w-56 space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{cad(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>
            {contractor.taxLabel} ({Math.round(contractor.taxRate * 1000) / 10}%)
          </span>
          <span>{cad(totals.tax)}</span>
        </div>
        <div className="flex justify-between border-t border-stone-300 pt-2 text-base font-semibold">
          <span>Total</span>
          <span>{cad(totals.total)}</span>
        </div>
      </div>
      {kind === "Invoice" && contractor.etransferEmail ? (
        <p className="mt-8 text-sm">
          Pay by Interac e-Transfer to <strong>{contractor.etransferEmail}</strong>
          {contractor.etransferNote ? ` — ${contractor.etransferNote}` : "."}
        </p>
      ) : null}
      {notes ? <p className="mt-6 whitespace-pre-line text-sm text-stone-700">{notes}</p> : null}
    </div>
  );
}
