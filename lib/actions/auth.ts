"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  clearSessionCookie,
  findUserByEmail,
  getContractor,
  getSession,
  hashPassword,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { ensureDb } from "@/lib/db";
import { contractors, users } from "@/lib/db/schema";

function id() {
  return crypto.randomUUID();
}

export async function signupAction(_: unknown, formData: FormData) {
  const email = String(formData.get("email") || "")
    .toLowerCase()
    .trim();
  const password = String(formData.get("password") || "");
  if (!email.includes("@") || password.length < 8) {
    return { error: "Use a real email and a password of at least 8 characters." };
  }
  const existing = await findUserByEmail(email);
  if (existing) return { error: "An account with that email already exists." };

  const db = await ensureDb();
  const userId = id();
  const contractorId = id();
  const now = Date.now();
  await db.insert(users).values({
    id: userId,
    email,
    passwordHash: hashPassword(password),
    createdAt: now,
  });
  await db.insert(contractors).values({
    id: contractorId,
    userId,
    email,
    plan: "pro",
  });
  await setSessionCookie(userId, contractorId);
  redirect("/onboarding");
}

export async function loginAction(_: unknown, formData: FormData) {
  const email = String(formData.get("email") || "")
    .toLowerCase()
    .trim();
  const password = String(formData.get("password") || "");
  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "Email or password is wrong." };
  }
  const db = await ensureDb();
  const [contractor] = await db
    .select()
    .from(contractors)
    .where(eq(contractors.userId, user.id))
    .limit(1);
  if (!contractor) return { error: "That account is missing a business profile." };
  await setSessionCookie(user.id, contractor.id);
  if (!contractor.onboardingCompletedAt) redirect("/onboarding");
  redirect("/app");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/");
}

export async function completeOnboardingAction(_: unknown, formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");
  const businessName = String(formData.get("businessName") || "").trim();
  if (!businessName) return { error: "Business name is required." };

  const taxPct = Number(formData.get("taxPct") || 13);
  const db = await ensureDb();
  await db
    .update(contractors)
    .set({
      businessName,
      businessAddress: String(formData.get("businessAddress") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      gstHstNumber: String(formData.get("gstHstNumber") || "").trim(),
      taxLabel: String(formData.get("taxLabel") || "HST").trim() || "HST",
      taxRate: Number.isFinite(taxPct) ? taxPct / 100 : 0.13,
      labourRateHourly: Number(formData.get("labourRate") || 85) || 85,
      defaultMarkupPct: Number(formData.get("markupPct") || 20) || 20,
      etransferEmail: String(formData.get("etransferEmail") || "").trim(),
      etransferNote: String(formData.get("etransferNote") || "").trim(),
      onboardingCompletedAt: Date.now(),
      plan: "pro",
    })
    .where(eq(contractors.id, session.contractorId));
  redirect("/app");
}

export async function updateSettingsAction(_: unknown, formData: FormData) {
  const contractor = await getContractor();
  const taxPct = Number(formData.get("taxPct") || contractor.taxRate * 100);
  const db = await ensureDb();
  await db
    .update(contractors)
    .set({
      businessName: String(formData.get("businessName") || "").trim(),
      businessAddress: String(formData.get("businessAddress") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      gstHstNumber: String(formData.get("gstHstNumber") || "").trim(),
      taxLabel: String(formData.get("taxLabel") || "HST").trim() || "HST",
      taxRate: Number.isFinite(taxPct) ? taxPct / 100 : contractor.taxRate,
      labourRateHourly: Number(formData.get("labourRate") || contractor.labourRateHourly),
      defaultMarkupPct: Number(formData.get("markupPct") || contractor.defaultMarkupPct),
      etransferEmail: String(formData.get("etransferEmail") || "").trim(),
      etransferNote: String(formData.get("etransferNote") || "").trim(),
    })
    .where(eq(contractors.id, contractor.id));
  return { ok: true };
}
