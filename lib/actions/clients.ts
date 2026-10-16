"use server";

import { revalidatePath } from "next/cache";
import { formText } from "@/lib/actions/form-data";
import { saveClientSchema } from "@/lib/actions/schemas";
import { getContractor } from "@/lib/auth";
import { ensureDb } from "@/lib/db";
import { NotFoundError } from "@/lib/services/context";
import { saveClient } from "@/lib/services/clients";

export async function saveClientAction(_: unknown, formData: FormData) {
  const parsed = saveClientSchema.safeParse({
    id: formText(formData, "id") || undefined,
    name: formText(formData, "name"),
    email: formText(formData, "email"),
    phone: formText(formData, "phone"),
    billingAddress: formText(formData, "billingAddress"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  try {
    const contractor = await getContractor();
    const clientId = await saveClient({ db: await ensureDb(), contractorId: contractor.id }, parsed.data);
    revalidatePath("/app/clients");
    revalidatePath("/app/jobs");
    return { ok: true, clientId };
  } catch (error) {
    if (error instanceof NotFoundError) return { error: error.message };
    throw error;
  }
}
