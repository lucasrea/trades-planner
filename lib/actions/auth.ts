"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { getContractor, getSession } from "@/lib/auth";
import { formNumber, formText } from "@/lib/actions/form-data";
import { ensureDb } from "@/lib/db";
import { contractors } from "@/lib/db/schema";

type ContractorDefaults = {
  taxRate: number;
  labourRateHourly: number;
  defaultMarkupPct: number;
};

function contractorProfileValues(
  formData: FormData,
  defaults: ContractorDefaults,
) {
  const taxPct = formNumber(formData, "taxPct", defaults.taxRate * 100);
  return {
    businessName: formText(formData, "businessName"),
    businessAddress: formText(formData, "businessAddress"),
    phone: formText(formData, "phone"),
    email: formText(formData, "email"),
    gstHstNumber: formText(formData, "gstHstNumber"),
    taxLabel: formText(formData, "taxLabel", "HST") || "HST",
    taxRate: taxPct / 100,
    labourRateHourly: formNumber(
      formData,
      "labourRate",
      defaults.labourRateHourly,
    ),
    defaultMarkupPct: formNumber(
      formData,
      "markupPct",
      defaults.defaultMarkupPct,
    ),
    etransferEmail: formText(formData, "etransferEmail"),
    etransferNote: formText(formData, "etransferNote"),
  };
}

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
  const profile = contractorProfileValues(formData, {
    taxRate: 0.13,
    labourRateHourly: 85,
    defaultMarkupPct: 20,
  });
  if (!profile.businessName) return { error: "Business name is required." };

  const db = await ensureDb();
  await db
    .update(contractors)
    .set({
      ...profile,
      onboardingCompletedAt: Date.now(),
      plan: "pro",
    })
    .where(eq(contractors.id, session.contractorId));
  revalidatePath("/app");
  revalidatePath("/app/settings");
  revalidatePath("/onboarding");
  return { redirectTo: "/app" };
}

export async function updateSettingsAction(_: unknown, formData: FormData) {
  const contractor = await getContractor();
  const profile = contractorProfileValues(formData, contractor);
  if (!profile.businessName) return { error: "Business name is required." };
  const db = await ensureDb();
  await db
    .update(contractors)
    .set(profile)
    .where(eq(contractors.id, contractor.id));
  revalidatePath("/app/settings");
  revalidatePath("/app");
  return { ok: true };
}
