"use server";

import { revalidatePath } from "next/cache";
import { formEnum, formText } from "@/lib/actions/form-data";
import { saveJobSchema, setJobStatusSchema } from "@/lib/actions/schemas";
import { getContractor } from "@/lib/auth";
import { ensureDb } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/services/context";
import { createJobWithClient, setJobStatus, updateJob, type JobStatus } from "@/lib/services/jobs";

const jobStatuses = ["quoted", "active", "done"] as const;

async function ctx() {
  const contractor = await getContractor();
  return { db: await ensureDb(), contractorId: contractor.id };
}

export async function saveJobAction(_: unknown, formData: FormData) {
  const parsed = saveJobSchema.safeParse({
    id: formText(formData, "id") || undefined,
    title: formText(formData, "title"),
    siteAddress: formText(formData, "siteAddress"),
    notes: formText(formData, "notes"),
    clientId: formText(formData, "clientId") || undefined,
    clientName: formText(formData, "clientName"),
    clientEmail: formText(formData, "clientEmail"),
    clientPhone: formText(formData, "clientPhone"),
    clientBillingAddress: formText(formData, "clientBillingAddress"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  try {
    const context = await ctx();
    if (parsed.data.id) {
      await updateJob(context, parsed.data.id, {
        title: parsed.data.title,
        siteAddress: parsed.data.siteAddress,
        notes: parsed.data.notes,
        clientId: parsed.data.clientId!,
      });
      revalidatePath("/app/jobs");
      revalidatePath(`/app/jobs/${parsed.data.id}`);
      return { ok: true, jobId: parsed.data.id };
    }
    const jobId = await createJobWithClient(context, {
      title: parsed.data.title,
      siteAddress: parsed.data.siteAddress,
      notes: parsed.data.notes,
      client: parsed.data.clientId
        ? { id: parsed.data.clientId }
        : { name: parsed.data.clientName!.trim(), email: parsed.data.clientEmail, phone: parsed.data.clientPhone, billingAddress: parsed.data.clientBillingAddress },
    });
    revalidatePath("/app/jobs");
    return { ok: true, jobId };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) return { error: error.message };
    throw error;
  }
}

export async function setJobStatusAction(_: unknown, formData: FormData) {
  const parsed = setJobStatusSchema.safeParse({ jobId: formText(formData, "jobId"), status: formEnum(formData, "status", jobStatuses, "quoted") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  try {
    await setJobStatus(await ctx(), parsed.data.jobId, parsed.data.status as JobStatus);
    revalidatePath(`/app/jobs/${parsed.data.jobId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) return { error: error.message };
    throw error;
  }
}
