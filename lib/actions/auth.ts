"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { getContractor, getSession } from "@/lib/auth";
import { ensureDb } from "@/lib/db";
import { contractors } from "@/lib/db/schema";

function safeNext(value: FormDataEntryValue | string | null) {
  const next = String(value || "/app");
  if (
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/login") &&
    !next.startsWith("/signup") &&
    !next.startsWith("/api")
  ) {
    return next;
  }
  return "/app";
}

export async function googleSignInAction(formData: FormData) {
  await signIn("google", { redirectTo: safeNext(formData.get("next")) });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
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
  revalidatePath("/app");
  redirect("/app");
}

export async function updateSettingsAction(_: unknown, formData: FormData) {
  const contractor = await getContractor();
  const businessName = String(formData.get("businessName") || "").trim();
  if (!businessName) return { error: "Business name is required." };
  const taxPct = Number(formData.get("taxPct") || contractor.taxRate * 100);
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
      taxRate: Number.isFinite(taxPct) ? taxPct / 100 : contractor.taxRate,
      labourRateHourly: Number(formData.get("labourRate") || contractor.labourRateHourly),
      defaultMarkupPct: Number(formData.get("markupPct") || contractor.defaultMarkupPct),
      etransferEmail: String(formData.get("etransferEmail") || "").trim(),
      etransferNote: String(formData.get("etransferNote") || "").trim(),
    })
    .where(eq(contractors.id, contractor.id));
  revalidatePath("/app/settings");
  revalidatePath("/app");
  return { ok: true };
}
