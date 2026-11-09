import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearFakeEmails, getFakeEmails, sendEmail, setEmailFetchForTests } from "@/lib/email";

describe("email", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    clearFakeEmails();
    setEmailFetchForTests(undefined);
  });

  afterEach(() => {
    process.env = env;
    setEmailFetchForTests(undefined);
    clearFakeEmails();
  });

  it("records fake messages in memory", async () => {
    process.env.EMAIL_PROVIDER = "fake";
    await sendEmail({ to: "c@example.com", subject: "Hi", text: "Body" });
    expect(getFakeEmails()).toEqual([{ to: "c@example.com", subject: "Hi", text: "Body" }]);
    clearFakeEmails();
    expect(getFakeEmails()).toEqual([]);
  });

  it("posts to Resend through an injected fetch", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "hello@example.com";
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }));
    setEmailFetchForTests(fetchMock);
    await sendEmail({ to: "c@example.com", subject: "Subject", text: "Text" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("https://api.resend.com/emails");
    const init = call?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer re_test",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      from: "hello@example.com",
      to: ["c@example.com"],
      subject: "Subject",
      text: "Text",
    });
  });
});
