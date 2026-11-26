import { getTestDatabaseUrl } from "../helpers/db";

// Route handlers under test open their own connection from DATABASE_URL (lib/db). Point it at the checked
// test database, so a DATABASE_URL already in the shell is never read or written.
process.env.DATABASE_URL = getTestDatabaseUrl();
