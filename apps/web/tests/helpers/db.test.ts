import { describe, expect, it } from "vitest";
import { getTestDatabaseUrl } from "./db";

const remote = "postgres://postgres:secret@db.example.supabase.co:5432/postgres";

describe("getTestDatabaseUrl", () => {
  it("requires DATABASE_URL_TEST and never falls back to DATABASE_URL", () => {
    const local = "postgres://ci:ci@127.0.0.1:5432/ci";
    expect(() => getTestDatabaseUrl({ DATABASE_URL: local })).toThrow("DATABASE_URL_TEST is required");
    expect(() => getTestDatabaseUrl({ DATABASE_URL: local, DATABASE_URL_TEST: "  " })).toThrow(
      "DATABASE_URL_TEST is required",
    );
    expect(() => getTestDatabaseUrl({ DATABASE_URL: remote, CI: "true" })).toThrow("DATABASE_URL_TEST is required");
  });

  it.each([
    "postgres://ci:ci@localhost:5432/ci",
    "postgresql://ci:ci@LOCALHOST/ci",
    "postgres://ci:ci@127.0.0.1:54329/ci",
    "postgres://ci:ci@[::1]:5432/ci",
    "postgres://ci:ci@db.localhost:5432/ci",
  ])("accepts the local database %s", (url) => {
    expect(getTestDatabaseUrl({ DATABASE_URL_TEST: url })).toBe(url);
  });

  it.each([
    remote,
    "postgres://ci:ci@postgres:5432/ci",
    "postgres://ci:ci@192.168.1.20:5432/ci",
    "postgres://ci:ci@localhost.example.com/ci",
    "postgres://ci:localhost@db.example.com/ci?host=localhost",
    "postgres://ci:ci@db.example.com,db.localhost/ci",
    "postgres://ci:ci@db.example.com%2Cdb.localhost/ci",
    "postgres://ci:ci@db.example.com,ci@localhost/ci",
    "postgres:///ci",
    "http://localhost/ci",
    "localhost:5432/ci",
  ])("refuses %s outside CI", (url) => {
    expect(() => getTestDatabaseUrl({ DATABASE_URL_TEST: url })).toThrow("Refusing to run");
  });

  it("does not echo the URL or its password", () => {
    expect(() => getTestDatabaseUrl({ DATABASE_URL_TEST: remote })).toThrow(
      expect.objectContaining({ message: expect.not.stringMatching(/secret|supabase/) }),
    );
  });

  it("allows another host only when CI is exactly true", () => {
    expect(getTestDatabaseUrl({ DATABASE_URL_TEST: remote, CI: "true" })).toBe(remote);
    expect(() => getTestDatabaseUrl({ DATABASE_URL_TEST: remote, CI: "1" })).toThrow("Refusing to run");
  });
});
