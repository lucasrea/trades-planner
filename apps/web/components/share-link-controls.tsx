"use client";

import { useState, useTransition } from "react";
import { createDocumentLinkAction, revokeDocumentLinkAction } from "@/lib/actions/share";
import { buildMailto, type DocType } from "@/lib/documents";

export type ShareMailInput = {
  businessName: string;
  type: DocType;
  number: string;
  clientEmail: string;
  total: number;
  dueOrValid: string | null;
  etransferInstructions: string;
};

function linkUrl(token: string) {
  return `${window.location.origin}/d/${token}`;
}

/** Copy link, Email link and Turn off link for a draft or sent document. */
export function ShareLinkControls({
  documentId,
  initialToken,
  mail,
}: {
  documentId: string;
  initialToken: string | null;
  /** Present when the client has an email. */
  mail: ShareMailInput | null;
}) {
  const [token, setToken] = useState(initialToken);
  const [message, setMessage] = useState("");
  const [shownUrl, setShownUrl] = useState("");
  const [pending, startTransition] = useTransition();

  async function ensureToken() {
    if (token) return token;
    const result = await createDocumentLinkAction(documentId);
    if ("error" in result) {
      setMessage(result.error);
      return null;
    }
    setToken(result.token);
    return result.token;
  }

  function copy() {
    setMessage("");
    setShownUrl("");
    startTransition(async () => {
      const current = await ensureToken();
      if (!current) return;
      const url = linkUrl(current);
      try {
        await navigator.clipboard.writeText(url);
        setMessage("Link copied.");
      } catch {
        setShownUrl(url);
        setMessage("Copy this link:");
      }
    });
  }

  function email() {
    if (!mail) return;
    setMessage("");
    setShownUrl("");
    startTransition(async () => {
      const current = await ensureToken();
      if (!current) return;
      window.location.href = buildMailto({ ...mail, link: linkUrl(current) });
    });
  }

  function turnOff() {
    setMessage("");
    setShownUrl("");
    startTransition(async () => {
      const result = await revokeDocumentLinkAction(documentId);
      if ("error" in result) {
        setMessage(result.error);
        return;
      }
      setToken(null);
      setMessage("Link turned off.");
    });
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={copy} disabled={pending}>
        Copy link
      </button>
      {mail ? (
        <button type="button" className="btn btn-ghost" onClick={email} disabled={pending}>
          Email link
        </button>
      ) : (
        <span className="self-center text-sm text-muted">No client email</span>
      )}
      {token ? (
        <button type="button" className="btn btn-ghost" onClick={turnOff} disabled={pending}>
          Turn off link
        </button>
      ) : null}
      {message ? (
        <span className="self-center text-sm text-muted" role="status">
          {message}
        </span>
      ) : null}
      {shownUrl ? (
        <input className="input max-w-sm" readOnly value={shownUrl} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
      ) : null}
    </>
  );
}
