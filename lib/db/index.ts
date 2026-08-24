import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;

let sql: ReturnType<typeof postgres> | null = null;
let db: Db | null = null;

function getSql() {
  if (sql) return sql;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required. Add your Supabase Postgres connection string to .env.local (local) and Vercel env vars (production).",
    );
  }

  sql = postgres(databaseUrl, {
    prepare: false,
    ssl: databaseUrl.includes("localhost") ? false : "require",
  });
  return sql;
}

function getDb(): Db {
  if (!db) db = drizzle(getSql(), { schema });
  return db;
}

export async function ensureDb() {
  return getDb();
}
