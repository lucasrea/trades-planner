export type EmailMessage = { to: string; subject: string; text: string };

const fakeSent: EmailMessage[] = [];

export function getFakeEmails(): readonly EmailMessage[] {
  return fakeSent;
}

export function clearFakeEmails(): void {
  fakeSent.length = 0;
}

export function isEmailProviderConfigured(): boolean {
  const provider = process.env.EMAIL_PROVIDER;
  return provider === "fake" || provider === "resend";
}

type FetchFn = typeof fetch;

let emailFetchOverride: FetchFn | undefined;

/** Test hook: inject fetch for the Resend path. The fake path never uses the network. */
export function setEmailFetchForTests(fetchFn: FetchFn | undefined): void {
  emailFetchOverride = fetchFn;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER;
  if (provider === "fake") {
    fakeSent.push({ ...message });
    return;
  }
  if (provider !== "resend") {
    throw new Error("Email is not configured.");
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey?.trim() || !from?.trim()) {
    throw new Error("Email is not configured.");
  }
  const doFetch = emailFetchOverride ?? fetch;
  const response = await doFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend returned ${response.status}.`);
  }
}
