import { formatDisplayDate } from "@/lib/format";
import { cad, computeTotals, lineTotal, storedTaxPercent, type DraftLine, type LineKind } from "@/lib/money";

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

const kindLabel: Record<LineKind, string> = {
  material: "Materials",
  labour: "Labour",
  other: "Other",
};

const docTitle = {
  Quote: "Quote",
  Invoice: "Invoice",
} as const;

function logoInitials(businessName: string) {
  const parts = businessName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (businessName.trim()[0] || "B").toUpperCase();
}

function BusinessLogo({
  businessName,
  logoUrl,
}: {
  businessName: string;
  logoUrl?: string;
}) {
  const label = businessName || "Business";
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`${label} logo`}
        width={64}
        height={64}
        className="h-16 w-16 rounded-lg border border-stone-300 object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-stone-300 bg-stone-800 text-lg font-medium text-white">
      {logoInitials(businessName)}
    </div>
  );
}

export function PrintDocument({
  kind,
  number,
  clientName,
  clientAddress,
  siteAddress,
  notes,
  dateLabel,
  dateValue,
  issueDate,
  lines,
  contractor,
  logoUrl,
  storedTotals,
}: {
  kind: "Quote" | "Invoice";
  number: string;
  clientName: string;
  clientAddress?: string;
  siteAddress?: string;
  notes?: string;
  dateLabel: string;
  dateValue?: string | null;
  issueDate?: string | number | null;
  lines: DraftLine[];
  contractor: Party;
  logoUrl?: string;
  storedTotals?: { subtotal: number; tax: number; total: number };
}) {
  const computed = computeTotals(lines, contractor.taxRate);
  const totals = storedTotals ?? computed;
  const usingStored = Boolean(storedTotals);
  const taxPercent = usingStored
    ? storedTaxPercent(totals.subtotal, totals.tax)
    : Math.round(contractor.taxRate * 1000) / 10;
  const taxCaption = taxPercent == null ? contractor.taxLabel : `${contractor.taxLabel} (${taxPercent}%)`;
  const showTax = usingStored ? totals.tax !== 0 : true;
  const issuedRaw = formatDisplayDate(issueDate, { month: "long" });
  const issued = issuedRaw === "—" ? null : issuedRaw;
  const secondaryRaw = formatDisplayDate(dateValue, { month: "long" });
  const secondaryDate = secondaryRaw === "—" ? null : secondaryRaw;
  const title = docTitle[kind];

  return (
    <div className="print-doc mx-auto max-w-[820px] bg-white text-stone-900 shadow-xl print:max-w-none print:shadow-none">
      <div className="border-b border-stone-300 px-10 pb-7 pt-10 print:px-0 print:pt-0">
        <div className="flex items-start justify-between gap-10">
          <div className="flex gap-4">
            <BusinessLogo businessName={contractor.businessName} logoUrl={logoUrl} />
            <div className="min-w-0 pt-0.5">
              <p className="text-xl font-semibold tracking-tight text-stone-900">
                {contractor.businessName || "Your business"}
              </p>
              {contractor.businessAddress ? (
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-stone-600">
                  {contractor.businessAddress}
                </p>
              ) : null}
              <div className="mt-1.5 text-sm text-stone-600">
                {[contractor.phone, contractor.email].filter(Boolean).join(" · ")}
              </div>
              {contractor.gstHstNumber ? (
                <p className="mt-1.5 text-sm text-stone-600">
                  GST/HST No. {contractor.gstHstNumber}
                </p>
              ) : null}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
              {title}
            </p>
            <p className="mt-0.5 text-2xl font-semibold tracking-tight text-stone-900">{number}</p>
            <dl className="mt-4 space-y-2 text-sm">
              {issued ? (
                <div>
                  <dt className="text-stone-500">Issue date</dt>
                  <dd className="font-medium text-stone-800">{issued}</dd>
                </div>
              ) : null}
              {secondaryDate ? (
                <div>
                  <dt className="text-stone-500">{dateLabel}</dt>
                  <dd className="font-medium text-stone-800">{secondaryDate}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
      </div>

      <div className="grid gap-6 px-10 py-7 sm:grid-cols-2 print:px-0">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">
            Prepared for
          </p>
          <p className="mt-1.5 text-base font-semibold text-stone-900">{clientName}</p>
          {clientAddress ? (
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-stone-600">
              {clientAddress}
            </p>
          ) : null}
        </div>
        {siteAddress ? (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">
              Service location
            </p>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-stone-800">
              {siteAddress}
            </p>
          </div>
        ) : null}
      </div>

      <div className="px-10 print:px-0">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-stone-900 text-left">
              <th className="py-2.5 pl-0 pr-2 font-medium text-stone-800">Description</th>
              <th className="w-24 py-2.5 px-2 font-medium text-stone-800">Category</th>
              <th className="w-28 py-2.5 px-2 font-medium text-stone-800">Quantity</th>
              <th className="w-28 py-2.5 px-2 font-medium text-stone-800">Rate</th>
              <th className="w-32 py-2.5 pl-2 pr-0 text-right font-medium text-stone-800">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-stone-500">
                  No items listed
                </td>
              </tr>
            ) : (
              lines.map((line) => (
                <tr key={line.id} className="border-b border-stone-200">
                  <td className="py-3 pl-0 pr-2 align-top text-stone-900">
                    {line.description || "—"}
                  </td>
                  <td className="py-3 px-2 align-top text-stone-600">
                    {kindLabel[line.kind] ?? line.kind}
                  </td>
                  <td className="py-3 px-2 align-top tabular-nums text-stone-700">
                    {line.quantity} {line.unit}
                  </td>
                  <td className="py-3 px-2 align-top tabular-nums text-stone-700">
                    {cad(line.unitPrice)}
                  </td>
                  <td className="py-3 pl-2 pr-0 text-right align-top tabular-nums font-medium text-stone-900">
                    {cad(lineTotal(line))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end px-10 py-7 print:px-0">
        <div className="w-full max-w-[280px] space-y-2 text-sm">
          <div className="flex justify-between text-stone-600">
            <span>Subtotal</span>
            <span className="tabular-nums text-stone-900">{cad(totals.subtotal)}</span>
          </div>
          {showTax ? (
            <div className="flex justify-between text-stone-600">
              <span>{taxCaption}</span>
              <span className="tabular-nums text-stone-900">{cad(totals.tax)}</span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-stone-900 pt-2 text-base font-semibold text-stone-900">
            <span>Total (CAD)</span>
            <span className="tabular-nums">{cad(totals.total)}</span>
          </div>
        </div>
      </div>

      {kind === "Invoice" && contractor.etransferEmail ? (
        <div className="mx-10 mb-6 border-t border-stone-200 pt-6 text-sm text-stone-700 print:mx-0">
          <p className="font-medium text-stone-900">Payment remittance</p>
          <p className="mt-1.5 leading-relaxed">
            Payment may be submitted by Interac e-Transfer to{" "}
            <span className="font-medium text-stone-900">{contractor.etransferEmail}</span>
            {contractor.etransferNote ? `. ${contractor.etransferNote}` : "."}
          </p>
        </div>
      ) : null}

      {kind === "Quote" && secondaryDate ? (
        <div className="mx-10 mb-6 border-t border-stone-200 pt-6 text-sm leading-relaxed text-stone-600 print:mx-0">
          <p>
            This quote is valid until{" "}
            <span className="font-medium text-stone-900">{secondaryDate}</span>. All amounts are
            stated in Canadian dollars and reflect the scope of work described above. Additional
            work or material changes will be subject to a revised quote.
          </p>
        </div>
      ) : null}

      {notes ? (
        <div className="border-t border-stone-200 px-10 py-6 print:px-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">
            Additional notes
          </p>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-700">{notes}</p>
        </div>
      ) : null}

      <div className="border-t border-stone-200 px-10 py-5 text-center text-xs text-stone-500 print:px-0">
        {kind === "Quote"
          ? "We appreciate the opportunity to provide this quote."
          : "Thank you for your prompt payment."}
      </div>
    </div>
  );
}
