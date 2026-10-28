import { describe, expect, it } from "vitest";
import { isLocalPostgresConnectionString, postgresSslOption } from "./postgres-url";

describe("postgres-url", () => {
  it("treats loopback and CI service hosts as non-TLS", () => {
    for (const url of [
      "postgres://ci:ci@127.0.0.1:5432/ci",
      "postgres://user:pass@localhost:5432/db",
      "postgresql://user:pass@postgres:5432/db",
    ]) {
      expect(isLocalPostgresConnectionString(url)).toBe(true);
      expect(postgresSslOption(url)).toBe(false);
    }
  });

  it("requires SSL for remote hosts", () => {
    const url = "postgres://user:pass@db.abcdef.supabase.co:5432/postgres";
    expect(isLocalPostgresConnectionString(url)).toBe(false);
    expect(postgresSslOption(url)).toBe("require");
  });
});
