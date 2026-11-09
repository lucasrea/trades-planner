"use server";

import { signOut } from "@/auth";
import { getContractor } from "@/lib/auth";
import { ensureDb } from "@/lib/db";
import { formText } from "@/lib/actions/form-data";
import { NotFoundError, ValidationError } from "@/lib/services/context";
import { deleteAccount } from "@/lib/services/account";
import { getReceiptStorage } from "@/lib/storage/receipts";

export type DeleteAccountState = { error: string } | null;

/** Delete the signed-in contractor's account when they typed the business name, then sign out. */
export async function deleteAccountAction(_: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const contractor = await getContractor();
  try {
    const result = await deleteAccount(
      { db: await ensureDb(), contractorId: contractor.id },
      {
        confirmBusinessName: formText(formData, "confirmBusinessName"),
        // Resolved lazily so a storage misconfiguration never blocks deleting the rows.
        storage: { remove: async (path) => getReceiptStorage().remove(path) },
      },
    );
    if (result.receiptsFailed > 0) {
      console.error(`Account deleted but ${result.receiptsFailed} receipt object(s) could not be removed.`);
    }
  } catch (error) {
    if (error instanceof ValidationError) return { error: "That doesn't match your business name. Nothing was deleted." };
    if (error instanceof NotFoundError) return { error: "Account not found." };
    throw error;
  }
  await signOut({ redirectTo: "/" });
  return null;
}
