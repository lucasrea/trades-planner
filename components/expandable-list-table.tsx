"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TableCard } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";

export type ExpandableAction =
  | { kind: "link"; href: string; label: string; external?: boolean }
  | { kind: "form"; action: (formData: FormData) => void | Promise<void>; id: string; label: string };

export type ExpandableCell =
  | { kind: "text"; value: string; className?: string }
  | { kind: "status"; status: string }
  | { kind: "action"; href: string; label: string; external?: boolean }
  | { kind: "actions"; items: ExpandableAction[] };

export type ExpandableDetail = {
  label: string;
  value: string;
  href?: string;
  status?: string;
};

export type ExpandableListRow = {
  id: string;
  label: string;
  href: string;
  cells: ExpandableCell[];
  details: ExpandableDetail[];
};

function renderAction(item: ExpandableAction) {
  if (item.kind === "form") {
    return (
      <form action={item.action}>
        <input type="hidden" name="id" value={item.id} />
        <button className="btn btn-ghost btn-sm">{item.label}</button>
      </form>
    );
  }
  return (
    <Link
      href={item.href}
      target={item.external ? "_blank" : undefined}
      rel={item.external ? "noopener noreferrer" : undefined}
      className="btn btn-ghost btn-sm"
    >
      {item.label}
    </Link>
  );
}

function renderCell(cell: ExpandableCell) {
  if (cell.kind === "text") {
    return <span className={cell.className}>{cell.value}</span>;
  }
  if (cell.kind === "status") {
    return <StatusBadge status={cell.status} />;
  }
  if (cell.kind === "actions") {
    return (
      <div className="flex flex-wrap justify-end gap-1">
        {cell.items.map((item, index) => (
          <span key={`${item.label}-${index}`}>{renderAction(item)}</span>
        ))}
      </div>
    );
  }
  return <span className="block text-right">{renderAction({ kind: "link", href: cell.href, label: cell.label, external: cell.external })}</span>;
}

function renderDetail(detail: ExpandableDetail) {
  if (detail.status) {
    return <StatusBadge status={detail.status} />;
  }
  if (detail.href) {
    return (
      <Link href={detail.href} className="hover:underline">
        {detail.value}
      </Link>
    );
  }
  return detail.value;
}

export function ExpandableListTable({
  columns,
  rows,
  minWidth = "640px",
}: {
  columns: { label: string; align?: "left" | "right" }[];
  rows: ExpandableListRow[];
  minWidth?: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggle(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  return (
    <TableCard>
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead className="bg-paper text-left text-muted">
          <tr>
            {columns.map((column) => (
              <th
                key={column.label}
                className={`px-4 py-3 font-medium ${column.align === "right" ? "text-right" : ""}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const expanded = expandedId === row.id;
            return (
              <RowGroup
                key={row.id}
                row={row}
                expanded={expanded}
                colSpan={columns.length}
                onToggle={() => toggle(row.id)}
              />
            );
          })}
        </tbody>
      </table>
    </TableCard>
  );
}

function RowGroup({
  row,
  expanded,
  colSpan,
  onToggle,
}: {
  row: ExpandableListRow;
  expanded: boolean;
  colSpan: number;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-t border-line hover:bg-paper/70">
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="rounded p-0.5 text-muted hover:bg-paper hover:text-ink"
              aria-expanded={expanded}
              aria-label={expanded ? `Hide details for ${row.label}` : `Show details for ${row.label}`}
              onClick={onToggle}
            >
              <ChevronRight
                size={16}
                className={`transition-transform ${expanded ? "rotate-90" : ""}`}
              />
            </button>
            <Link href={row.href} className="font-medium hover:underline">
              {row.label}
            </Link>
          </div>
        </td>
        {row.cells.map((cell, index) => (
          <td key={`${row.id}-cell-${index}`} className="px-4 py-3">
            {renderCell(cell)}
          </td>
        ))}
      </tr>
      {expanded ? (
        <tr className="border-t border-line bg-paper/40">
          <td colSpan={colSpan} className="px-4 py-3">
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {row.details.map((detail) => (
                <div key={detail.label}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">{detail.label}</dt>
                  <dd className="mt-1 text-ink">{renderDetail(detail)}</dd>
                </div>
              ))}
            </dl>
          </td>
        </tr>
      ) : null}
    </>
  );
}
