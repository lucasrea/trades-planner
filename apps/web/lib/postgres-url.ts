/** True for loopback, docker-compose service name, and other non-TLS Postgres targets. */
export function isLocalPostgresConnectionString(connectionString: string): boolean {
  try {
    const parsed = new URL(connectionString.replace(/^postgres(?:ql)?:/, "http:"));
    const host = parsed.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "postgres";
  } catch {
    return connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
  }
}

export function postgresSslOption(connectionString: string): false | "require" {
  return isLocalPostgresConnectionString(connectionString) ? false : "require";
}
