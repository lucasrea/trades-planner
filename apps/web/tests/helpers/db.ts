import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";
import { postgresSslOption } from "@/lib/postgres-url";

export type TestDatabase = PostgresJsDatabase<typeof schema>;

let sql: ReturnType<typeof postgres> | null = null;
let db: TestDatabase | null = null;

function isLocalTestDatabaseUrl(url: string) {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== "postgres:" && protocol !== "postgresql:") return false;
    const name = hostname.toLowerCase();
    const local = name === "localhost" || name === "127.0.0.1" || name === "[::1]" || name.endsWith(".localhost");
    if (!local) return false;
    // postgres.js parses the string its own way and accepts host lists, so it must read this one host too.
    // Building a client opens no connection. The driver cuts "[::1]" at its first colon.
    const driverHosts = postgres(url).options.host;
    return driverHosts.length === 1 && driverHosts[0] === hostname.split(":")[0];
  } catch {
    return false;
  }
}

/**
 * The only database integration tests and the Plan eval may use. They drop its public schema, so there is
 * no fallback to DATABASE_URL, and outside CI the host must be this machine. Errors never echo the URL,
 * which holds a password.
 */
export function getTestDatabaseUrl(env: Record<string, string | undefined> = process.env) {
  const url = env.DATABASE_URL_TEST?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL_TEST is required. These tests drop the public schema, so point it at a throwaway database (see CLAUDE.md). DATABASE_URL is never used.",
    );
  }
  if (env.CI !== "true" && !isLocalTestDatabaseUrl(url)) {
    throw new Error(
      "Refusing to run: DATABASE_URL_TEST is not a local database, and these tests drop the public schema. Use a postgres:// URL with host localhost or 127.0.0.1. Other hosts are allowed only in CI (CI=true).",
    );
  }
  return url;
}

export function getTestSql() {
  if (!sql) {
    const url = getTestDatabaseUrl();
    sql = postgres(url, { prepare: false, max: 1, ssl: postgresSslOption(url) });
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
