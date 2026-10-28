"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContractor } from "@/lib/auth";
import { ensureDb } from "@/lib/db";
import { ZodError } from "zod";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/services/context";
import { confirmCapture, discardCapture, type ConfirmCaptureInput } from "@/lib/services/captures";

async function ctx() {
  const contractor = await getContractor();
  return { db: await ensureDb(), contractorId: contractor.id };
}

export async function confirmCaptureAction(input: ConfirmCaptureInput) {
  try {
    const result = await confirmCapture(await ctx(), input);
    revalidatePath("/app/documents");
    revalidatePath("/app/jobs");
    revalidatePath(`/app/captures/${input.captureId}`);
    if (result.kind === "document") redirect(`/app/documents/${result.documentId}`);
    if (result.jobIds.length === 1) redirect(`/app/jobs/${result.jobIds[0]}`);
    redirect(`/app/jobs?capture=${input.captureId}`);
  } catch (error) {
    if (
      error instanceof NotFoundError ||
      error instanceof ValidationError ||
      error instanceof ConflictError ||
      error instanceof ZodError
    ) {
      redirect(`/app/captures/${input.captureId}?error=invalid`);
    }
    throw error;
  }
}

export async function discardCaptureAction(captureId: string) {
  try {
    await discardCapture(await ctx(), captureId);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ConflictError) {
      redirect(`/app/captures/${captureId}?error=invalid`);
    }
    throw error;
  }
  revalidatePath(`/app/captures/${captureId}`);
  redirect("/app");
}
