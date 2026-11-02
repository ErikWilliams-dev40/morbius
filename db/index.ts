import type { AppEnv } from "../lib/server";

// All SQL execution stays behind server-side prepared statements.
export function getDb(env: Pick<AppEnv, "DB">) {
  if (!env.DB) throw new Error("Workspace database is unavailable.");
  return env.DB;
}
