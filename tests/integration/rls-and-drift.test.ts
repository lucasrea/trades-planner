import { getTableColumns, getTableName, isTable } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { getTestSql } from "../helpers/db";

describe("rls and schema drift", () => {
  it("enables RLS on all tables", async () => {
    const rows = await getTestSql()`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false`;
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("matches drizzle schema", async () => {
    const dbColumns = await getTestSql()`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`;
    const set = new Set(dbColumns.map((r) => `${r.table_name}.${r.column_name}`));
    for (const value of Object.values(schema)) {
      if (!isTable(value)) continue;
      const table = getTableName(value);
      for (const col of Object.values(getTableColumns(value))) {
        expect(set.has(`${table}.${col.name}`)).toBe(true);
      }
    }
  });
});
