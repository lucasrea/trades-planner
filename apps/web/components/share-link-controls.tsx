"use client";

import { useEffect, useState, useTransition } from "react";
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
  allowCreate = true,
}: {
  documentId: string;
  initialToken: string | null;
  /** Present when the client has an email. */
  mail: ShareMailInput | null;
  /** Drafts and sent documents can create a link. Later statuses can only turn an existing one off. */
  allowCreate?: boolean;
}) {
  const [token, setToken] = useState(initialToken);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "muted" | "danger" } | null>(null);
  const [shownUrl, setShownUrl] = useState("");
  const [working, setWorking] = useState<"copy" | "email" | "revoke" | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!message || message.tone !== "ok") return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  async function ensureToken() {
    if (token) return token;
    const result = await createDocumentLinkAction(documentId);
    if ("error" in result) {
      setMessage({ text: result.error, tone: "danger" });
      return null;
    }
    setToken(result.token);
    return result.token;
  }

  function copy() {
    setMessage(null);
    setShownUrl("");
    setWorking("copy");
    startTransition(async () => {
      try {
        const current = await ensureToken();
        if (!current) return;
        const url = linkUrl(current);
        try {
          await navigator.clipboard.writeText(url);
          setMessage({ text: "Link copied.", tone: "ok" });
        } catch {
          setShownUrl(url);
          setMessage({ text: "Copy this link:", tone: "muted" });
        }
      } finally {
        setWorking(null);
      }
    });
  }

  function email() {
    if (!mail) return;
    setMessage(null);
    setShownUrl("");
    setWorking("email");
    startTransition(async () => {
      try {
        const current = await ensureToken();
        if (!current) return;
        window.location.href = buildMailto({ ...mail, link: linkUrl(current) });
      } finally {
        setWorking(null);
      }
    });
  }

  function turnOff() {
    setMessage(null);
    setShownUrl("");
    setWorking("revoke");
    startTransition(async () => {
      try {
        const result = await revokeDocumentLinkAction(documentId);
        if ("error" in result) {
          setMessage({ text: result.error, tone: "danger" });
          return;
        }
        setToken(null);
        setMessage({ text: "Link turned off.", tone: "ok" });
      } finally {
        setWorking(null);
      }
    });
  }

  return (
    <>
      {allowCreate ? (
        <button type="button" className="btn btn-ghost" onClick={copy} disabled={pending}>
          {pending && working === "copy" ? "Copying…" : "Copy link"}
        </button>
      ) : null}
      {allowCreate && mail ? (
        <button type="button" className="btn btn-ghost" onClick={email} disabled={pending}>
          {pending && working === "email" ? "Opening…" : "Email link"}
        </button>
      ) : null}
      {token ? (
        <button type="button" className="btn btn-danger" onClick={turnOff} disabled={pending}>
          {pending && working === "revoke" ? "Turning off…" : "Turn off link"}
        </button>
      ) : null}
      {message ? (
        <span
          className={`self-center text-sm ${
            message.tone === "ok" ? "text-ok" : message.tone === "danger" ? "text-danger" : "text-muted"
          }`}
          role={message.tone === "danger" ? "alert" : "status"}
        >
          {message.text}
        </span>
      ) : null}
      {shownUrl ? (
        <input className="input max-w-sm" readOnly value={shownUrl} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
      ) : null}
    </>
  );
}
