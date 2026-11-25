import { eq } from "drizzle-orm";
import { contractors } from "@/lib/db/schema";
import { NotFoundError, ValidationError, type ServiceContext } from "@/lib/services/context";

/** The business settings the form and Plan can change. Omitted fields stay as they are. */
export type SettingsInput = Partial<{
  businessName: string;
  businessAddress: string;
  phone: string;
  email: string;
  gstHstNumber: string;
  taxLabel: string;
  /** A fraction: 0.13 for 13 %. */
  taxRate: number;
  labourRateHourly: number;
  defaultMarkupPct: number;
  etransferEmail: string;
  etransferNote: string;
}>;

function inRange(value: number | undefined, min: number, max: number, message: string) {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < min || value > max) throw new ValidationError(message);
}

/** Save business settings. Shared by the settings form and Plan so both apply the same checks. */
export async function saveSettings(ctx: ServiceContext, input: SettingsInput) {
  if (input.businessName !== undefined && !input.businessName.trim()) throw new ValidationError("Business name is required.");
  if (input.taxLabel !== undefined && !input.taxLabel.trim()) throw new ValidationError("Tax label is required.");
  inRange(input.taxRate, 0, 0.2, "Tax rate must be between 0 and 20 %.");
  inRange(input.labourRateHourly, 0, 1000, "Labour rate must be between $0 and $1,000.");
  inRange(input.defaultMarkupPct, 0, 500, "Markup must be between 0 and 500 %.");
  const values = Object.fromEntries(
    Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]),
  ) as SettingsInput;
  if (Object.keys(values).length === 0) return;
  const [updated] = await ctx.db
    .update(contractors)
    .set(values)
    .where(eq(contractors.id, ctx.contractorId))
    .returning({ id: contractors.id });
  if (!updated) throw new NotFoundError("Contractor not found.");
}
