/**
 * Signed-in checks for Plan text, voice, and receipt captures.
 *
 * Localhost expects the fake provider (the default outside production).
 * Production calls the live models. Nothing is confirmed unless you pass --confirm,
 * and a production confirm also requires --job so it cannot land on whichever job
 * the model happens to name.
 *
 *   node tools/e2e/run.mjs --self-check
 *   node tools/e2e/run.mjs --target local
 *   node tools/e2e/run.mjs --target prod --job <throwaway-job-id>
 *   node tools/e2e/run.mjs --target prod --job <id> --confirm
 *
 * Cookie: TP_COOKIE, or one line in tools/e2e/.session (the Cookie header value).
 * That file is gitignored. Do not print it.
 */
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RECEIPT_LINES, VOICE_PHRASE, receiptPng, silentWav, writeFixtures } from "./fixtures.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const PROD_ORIGIN = "https://trades-planner-bay.vercel.app";
const LOCAL_TEXT = "Quote for Patel, four hours and a tank";

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1] ?? null;
}

function flag(name) {
  return process.argv.includes(name);
}

function hashKey(input) {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) | 0;
  return String(h);
}

/** Same fork as apps/web/lib/ai/fake.ts. Local assertions follow it. */
export function expectedFakeText(text) {
  const invoice = hashKey(text.trim().slice(0, 200)).endsWith("7");
  return invoice
    ? { clientName: "Chen", action: "make_invoice" }
    : { clientName: "Patel", action: "make_quote" };
}

export function expectedFakeReceipt(byteLength) {
  const vendor = hashKey(`image/png:${byteLength}`).endsWith("3") ? "Supply Co" : "Home Depot";
  return { vendor, description: "PEX fittings" };
}

function expectedFakeVoice(byteLength) {
  return `Fake transcript (audio/wav, ${byteLength} bytes).`;
}

async function loadCookie() {
  if (process.env.TP_COOKIE?.trim()) return process.env.TP_COOKIE.trim();
  try {
    const text = await readFile(path.join(root, ".session"), "utf8");
    const line = text.split("\n").map((part) => part.trim()).find((part) => part && !part.startsWith("#"));
    return line || null;
  } catch {
    return null;
  }
}

async function encodeAction(args) {
  try {
    const mod = await import(
      fileURLToPath(new URL("../../node_modules/next/dist/compiled/react-server-dom-webpack/client.node.js", import.meta.url))
    );
    return await mod.encodeReply(args);
  } catch {
    return JSON.stringify(args);
  }
}

function formFile(field, bytes, filename, type) {
  const form = new FormData();
  form.set(field, new Blob([bytes], { type }), filename);
  return form;
}

async function request(origin, pathname, { cookie, method = "GET", body, headers = {}, site = "same-origin", sendOrigin = true } = {}) {
  const url = new URL(pathname, origin);
  const reqHeaders = { ...headers };
  if (sendOrigin) {
    reqHeaders.origin = origin;
    reqHeaders["sec-fetch-site"] = site;
  }
  if (cookie) reqHeaders.cookie = cookie;
  const response = await fetch(url, { method, headers: reqHeaders, body, redirect: "manual" });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, text, headers: response.headers };
}

function check(results, name, ok, detail) {
  results.push({ name, ok, detail });
  const mark = ok ? "ok" : "FAIL";
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function pageScripts(origin, cookie, pathname) {
  const page = await request(origin, pathname, { cookie });
  const html = page.text;
  const srcs = new Set([
    ...[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1]),
    ...[...html.matchAll(/static\/chunks\/[^"\\\s)]+/g)].map((match) => `/_next/${match[0]}`),
  ]);
  const chunks = [html];
  for (const src of [...srcs].slice(0, 40)) {
    if (!src.includes("/_next/")) continue;
    const file = await request(origin, src.split("?")[0], { cookie, sendOrigin: false });
    if (file.status === 200) chunks.push(file.text);
  }
  return { status: page.status, location: page.headers.get("location"), source: chunks.join("\n") };
}

function actionId(source, name) {
  // Dev bundles keep the name in an escaped action map a few characters after its id.
  const found = source.match(new RegExp(`([0-9a-f]{42}).{0,40}${name}`));
  return found?.[1] ?? null;
}

async function callAction(origin, cookie, id, args) {
  const body = await encodeAction(args);
  return request(origin, "/app", {
    cookie,
    method: "POST",
    body,
    headers: {
      accept: "text/x-component",
      "content-type": "text/plain;charset=UTF-8",
      "next-action": id,
      "next-url": "/app",
    },
  });
}

async function selfCheck() {
  const png = receiptPng();
  const wav = silentWav();
  const pngOk = png[0] === 0x89 && png[1] === 0x50 && png[2] === 0x4e && png[3] === 0x47;
  const wavOk = wav.subarray(0, 4).toString() === "RIFF" && wav.subarray(8, 12).toString() === "WAVE";
  const fake = expectedFakeText(LOCAL_TEXT);
  const receipt = expectedFakeReceipt(png.length);
  const results = [];
  check(results, "receipt png magic", pngOk, `${png.length} bytes`);
  check(results, "silent wav magic", wavOk, `${wav.length} bytes`);
  check(results, "receipt text includes the prices", RECEIPT_LINES.some((line) => line.includes("12.50")));
  check(results, "fake text expectation", fake.clientName === "Patel" || fake.clientName === "Chen", fake.action);
  check(results, "fake receipt expectation", receipt.description === "PEX fittings", receipt.vendor);
  const dir = path.join(root, "out");
  await writeFixtures(dir, { speech: false });
  const written = await stat(path.join(dir, "receipt.png"));
  check(results, "fixtures write", written.size === png.length, path.join(dir, "receipt.png"));
  return results;
}

async function main() {
  if (flag("--help") || flag("-h")) {
    console.log("node tools/e2e/run.mjs --self-check | --target local|prod [--job id] [--confirm] [--keep] [--allow-create] [--speech]");
    return;
  }
  if (flag("--self-check")) {
    const results = await selfCheck();
    if (results.some((result) => !result.ok)) process.exit(1);
    return;
  }

  const target = arg("--target") ?? "local";
  if (target !== "local" && target !== "prod") {
    console.error("--target must be local or prod");
    process.exit(1);
  }
  const origin = (arg("--base") ?? (target === "prod" ? PROD_ORIGIN : "http://127.0.0.1:3000")).replace(/\/$/, "");
  const jobId = arg("--job") || process.env.TP_JOB_ID || "";
  const confirm = flag("--confirm");
  const keep = flag("--keep");
  const allowCreate = flag("--allow-create");
  const speech = flag("--speech") || target === "prod";
  const cookie = await loadCookie();
  const results = [];

  if (confirm && target === "prod" && !jobId) {
    console.error("Production --confirm requires --job, and that job should be a throwaway.");
    process.exit(1);
  }

  const dir = path.join(root, "out");
  let fixtures;
  try {
    fixtures = await writeFixtures(dir, { speech });
  } catch (error) {
    console.error(speech ? `Could not run say for the voice clip: ${error.message}` : error.message);
    process.exit(1);
  }
  const receiptBytes = await readFile(fixtures.receiptPath);
  const voiceBytes = await readFile(fixtures.voicePath);

  const anon = await request(origin, "/api/captures/text", {
    method: "POST",
    body: JSON.stringify({ text: "hello" }),
    headers: { "content-type": "application/json" },
  });
  check(results, "text without a session is 401", anon.status === 401, String(anon.status));

  const crossed = await request(origin, "/api/captures/text", {
    cookie,
    method: "POST",
    body: JSON.stringify({ text: "hello" }),
    headers: { "content-type": "application/json", origin: "https://evil.example" },
    site: "cross-site",
  });
  check(results, "cross-origin text is 403", crossed.status === 403, String(crossed.status));

  if (!cookie) {
    check(results, "session cookie", false, "Set TP_COOKIE or tools/e2e/.session, then re-run.");
    process.exit(1);
  }

  const home = await request(origin, "/app", { cookie });
  const signedIn = home.status === 200 && !String(home.headers.get("location") ?? "").includes("/login");
  check(results, "signed-in Plan page", signedIn, String(home.status));
  if (!signedIn) process.exit(1);

  const badImage = await request(origin, "/api/captures/receipt", {
    cookie,
    method: "POST",
    body: formFile("image", Buffer.from("not an image"), "note.txt", "text/plain"),
  });
  check(results, "non-image receipt is 400", badImage.status === 400, badImage.json?.error?.message ?? String(badImage.status));

  const badAudio = await request(origin, "/api/captures/voice", {
    cookie,
    method: "POST",
    body: formFile("audio", Buffer.from("not audio"), "note.txt", "text/plain"),
  });
  check(results, "non-audio voice is 400", badAudio.status === 400, badAudio.json?.error?.message ?? String(badAudio.status));

  const textBody = { text: target === "local" ? LOCAL_TEXT : `Create a job called E2E probe ${Date.now()} for client Test Client at 1 Test Lane.` };
  const text = await request(origin, "/api/captures/text", {
    cookie,
    method: "POST",
    body: JSON.stringify(textBody),
    headers: { "content-type": "application/json" },
  });
  const textPreview = text.json?.preview;
  let textOk = text.status === 200 && text.json?.status === "needs_review" && text.json?.transcript === textBody.text;
  let textDetail = text.json?.error?.message ?? text.json?.status ?? String(text.status);
  if (textOk && target === "local") {
    const expected = expectedFakeText(textBody.text);
    textOk = textPreview?.clientName === expected.clientName && textPreview?.action === expected.action;
    textDetail = `${textPreview?.action ?? "no preview"} / ${textPreview?.clientName ?? "no client"}`;
  }
  if (textOk && target === "prod") {
    textOk = textPreview?.action === "create_job" && textPreview?.canConfirm === true && String(textPreview?.jobTitle ?? "").includes("E2E probe");
    textDetail = `${textPreview?.action ?? "no preview"} / ${textPreview?.title ?? ""}`;
  }
  check(results, "text capture", textOk, textDetail);

  const voiceForm = formFile("audio", voiceBytes, "voice.wav", "audio/wav");
  if (jobId) voiceForm.set("jobId", jobId);
  const voice = await request(origin, "/api/captures/voice", { cookie, method: "POST", body: voiceForm });
  const voicePreview = voice.json?.preview;
  let voiceOk = voice.status === 200 && voice.json?.status === "needs_review";
  let voiceDetail = voice.json?.error?.message ?? voice.json?.transcript ?? voice.json?.status ?? String(voice.status);
  if (voiceOk && target === "local") {
    voiceOk = String(voice.json?.transcript ?? "").startsWith(expectedFakeVoice(voiceBytes.length));
    voiceDetail = voice.json?.transcript ?? "";
  }
  if (voiceOk && target === "prod") {
    const transcript = String(voice.json?.transcript ?? "");
    voiceOk = /valve/i.test(transcript) && Boolean(voicePreview?.action);
    if (jobId) voiceOk = voiceOk && voicePreview?.action === "add_materials" && voicePreview?.canConfirm === true;
    voiceDetail = transcript || "empty transcript";
  }
  check(results, "voice capture", voiceOk, voiceDetail);

  const receiptForm = formFile("image", receiptBytes, "receipt.png", "image/png");
  if (jobId) receiptForm.set("jobId", jobId);
  receiptForm.set("note", "E2E receipt");
  const receipt = await request(origin, "/api/captures/receipt", { cookie, method: "POST", body: receiptForm });
  let receiptOk = receipt.status === 200 && receipt.json?.status === "needs_review" && receipt.json?.reviewUrl;
  let receiptDetail = receipt.json?.error?.message ?? receipt.json?.status ?? String(receipt.status);
  if (receiptOk) {
    const review = await request(origin, receipt.json.reviewUrl, { cookie });
    const expected = target === "local" ? expectedFakeReceipt(receiptBytes.length) : { vendor: "HOME DEPOT", description: "Valve" };
    const haystack = review.text.toUpperCase();
    receiptOk = review.status === 200 && haystack.includes(expected.vendor.toUpperCase()) && haystack.includes(expected.description.toUpperCase());
    if (target === "prod") receiptOk = receiptOk && haystack.includes("COPPER") && haystack.includes("12.5");
    receiptDetail = receiptOk ? expected.vendor : `review ${review.status}, missing ${expected.vendor} / ${expected.description}`;
  }
  check(results, "receipt capture", receiptOk, receiptDetail);

  const plan = await pageScripts(origin, cookie, "/app");
  const cancelId = actionId(plan.source, "cancelPlanProposalAction");
  const confirmId = actionId(plan.source, "confirmPlanProposalAction");
  const discardId = actionId(plan.source, "discardCaptureAction");
  const captures = [
    ["text", text.json],
    ["voice", voice.json],
    ["receipt", receipt.json],
  ].filter((entry) => entry[1]?.captureId);

  if (confirm) {
    const voiceCanConfirm = voiceOk && voicePreview?.canConfirm === true && (!voicePreview.jobIsNew || allowCreate);
    if (!voiceCanConfirm) {
      check(results, "confirm voice", false, "Preview cannot be confirmed. Pass --job for an existing throwaway job.");
    } else if (!confirmId) {
      check(results, "confirm voice", false, `Open ${origin}${voice.json.reviewUrl} and confirm it there.`);
    } else {
      const posted = await callAction(origin, cookie, confirmId, [voice.json.captureId]);
      const redirect = posted.headers.get("x-action-redirect") ?? "";
      const missing = posted.headers.get("x-nextjs-action-not-found") === "1";
      check(results, "confirm voice", !missing && (redirect.startsWith("/app/jobs/") || posted.status === 303), redirect || String(posted.status));
    }
    if (!allowCreate) {
      check(results, "text left unconfirmed", true, "Create-job text is not confirmed unless you pass --allow-create.");
    }
  }

  if (!keep && !confirm) {
    if (!cancelId) {
      check(
        results,
        "discard captures",
        false,
        captures.map((entry) => entry[1].reviewUrl).join(" ") || "no captures, and no cancel action id",
      );
    } else {
      for (const [name, body] of captures) {
        const action = name === "receipt" ? discardId : cancelId;
        if (!action) {
          check(results, `discard ${name}`, false, `${origin}${body.reviewUrl}`);
          continue;
        }
        const posted = await callAction(origin, cookie, action, [body.captureId]);
        const missing = posted.headers.get("x-nextjs-action-not-found") === "1";
        check(results, `discard ${name}`, !missing && posted.status < 400, posted.headers.get("x-action-redirect") ?? String(posted.status));
      }
    }
  }

  if (speech) {
    check(results, "voice phrase", true, VOICE_PHRASE);
  }

  if (results.some((result) => !result.ok)) process.exit(1);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
