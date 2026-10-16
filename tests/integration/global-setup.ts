import fs from "node:fs";
import path from "node:path";
import { getTestSql, resetPublicSchema } from "../helpers/db";

export default async function globalSetup() {
  await resetPublicSchema();
  const dir = path.join(process.cwd(), "supabase/migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const sql = getTestSql();
  for (const file of files) await sql.unsafe(fs.readFileSync(path.join(dir, file), "utf8"));
}
