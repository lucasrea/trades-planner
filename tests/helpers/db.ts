import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

export type TestDatabase = PostgresJsDatabase<typeof schema>;

let sql: ReturnType<typeof postgres> | null = null;
let db: TestDatabase | null = null;

export function getTestDatabaseUrl() {
  const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_TEST is required for integration tests.");
  return url;
}

export function getTestSql() {
  if (!sql) {
    const url = getTestDatabaseUrl();
    sql = postgres(url, { prepare: false, max: 1, ssl: url.includes("localhost") ? false : "require" });
  }
  return sql;
}

export function getTestDb() {
  if (!db) db = drizzle(getTestSql(), { schema });
  return db;
}

export async function resetPublicSchema() {
  const client = getTestSql();
  await client`DROP SCHEMA IF EXISTS public CASCADE`;
  await client`CREATE SCHEMA public`;
}
