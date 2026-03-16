import { drizzle } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";
import * as schema from "./schema";

let _client: Client | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _initPromise: Promise<void> | null = null;

function getDbUrl(): string {
  if (process.env.TURSO_DATABASE_URL) {
    return process.env.TURSO_DATABASE_URL;
  }
  if (process.env.VERCEL) {
    return "file:/tmp/clawoss.db";
  }
  return "file:local.db";
}

function ensureClient(): Client {
  if (!_client) {
    _client = createClient({
      url: getDbUrl(),
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _client;
}

async function initSchema(): Promise<void> {
  const client = ensureClient();

  const statements = [
    `CREATE TABLE IF NOT EXISTS heartbeats (
      id TEXT PRIMARY KEY, timestamp INTEGER NOT NULL,
      status TEXT NOT NULL, current_task TEXT,
      uptime_seconds INTEGER, metadata TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS pull_requests (
      id TEXT PRIMARY KEY, github_id INTEGER NOT NULL,
      repo TEXT NOT NULL, number INTEGER NOT NULL,
      title TEXT NOT NULL, body TEXT,
      status TEXT NOT NULL, quality_score REAL,
      created_at INTEGER NOT NULL, merged_at INTEGER,
      closed_at INTEGER, additions INTEGER DEFAULT 0,
      deletions INTEGER DEFAULT 0, files_changed INTEGER DEFAULT 0,
      review_count INTEGER DEFAULT 0, html_url TEXT, metadata TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS pr_reviews (
      id TEXT PRIMARY KEY, pr_id TEXT NOT NULL,
      reviewer TEXT NOT NULL, state TEXT NOT NULL,
      body TEXT, submitted_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS quality_scores (
      id TEXT PRIMARY KEY, pr_id TEXT NOT NULL,
      overall_score REAL NOT NULL, scope_check REAL,
      code_quality REAL, test_coverage REAL,
      security REAL, anti_slop REAL,
      git_hygiene REAL, pr_template REAL,
      scored_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS metrics_tokens (
      id TEXT PRIMARY KEY, timestamp INTEGER NOT NULL,
      channel TEXT, provider TEXT, model TEXT,
      input_tokens INTEGER DEFAULT 0, output_tokens INTEGER DEFAULT 0,
      cost_usd REAL DEFAULT 0, run_duration_ms INTEGER,
      context_tokens INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS agent_logs (
      id TEXT PRIMARY KEY, timestamp INTEGER NOT NULL,
      level TEXT NOT NULL, source TEXT,
      message TEXT NOT NULL, metadata TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS command_audit (
      id TEXT PRIMARY KEY, timestamp INTEGER NOT NULL,
      action TEXT NOT NULL, session_key TEXT,
      sender_id TEXT, source TEXT, details TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS conversation_messages (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL, role TEXT NOT NULL,
      content TEXT NOT NULL, tool_name TEXT,
      tool_call_id TEXT, duration_ms INTEGER,
      token_count INTEGER, metadata TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_conversation_session_ts ON conversation_messages(session_id, timestamp DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_conversation_ts ON conversation_messages(timestamp DESC)`,
    `CREATE TABLE IF NOT EXISTS agent_state (
      id TEXT PRIMARY KEY, timestamp INTEGER NOT NULL,
      current_skill TEXT, current_repo TEXT,
      current_issue TEXT, work_queue TEXT,
      pipeline_state TEXT, active_repos TEXT,
      metadata TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY, value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
  ];

  for (const stmt of statements) {
    await client.execute(stmt);
  }

}

function ensureInit(): Promise<void> {
  if (!_initPromise) {
    _initPromise = initSchema().catch((err) => {
      _initPromise = null;
      throw err;
    });
  }
  return _initPromise;
}

function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) {
    _db = drizzle(ensureClient(), { schema });
  }
  return _db;
}

export async function ensureDb(): Promise<ReturnType<typeof drizzle<typeof schema>>> {
  await ensureInit();
  return getDb();
}

/**
 * Data retention: prune high-volume tables to prevent unbounded growth.
 * Called probabilistically from heartbeat ingest (~1 in 100 requests).
 *
 * Retention policy:
 * - heartbeats: keep last 7 days
 * - conversation_messages: keep last 7 days
 * - metrics_tokens: keep last 30 days
 * - agent_logs: keep last 14 days
 * - command_audit: keep last 14 days
 *
 * Low-volume tables (pull_requests, pr_reviews, quality_scores, settings, agent_state)
 * are never pruned — they have bounded growth.
 */
export async function pruneOldData(): Promise<{ deleted: Record<string, number> }> {
  const client = ensureClient();
  const now = Math.floor(Date.now() / 1000);
  const day = 86400;

  const targets = [
    { table: "heartbeats", maxAge: 7 * day },
    { table: "conversation_messages", maxAge: 7 * day },
    { table: "metrics_tokens", maxAge: 30 * day },
    { table: "agent_logs", maxAge: 14 * day },
    { table: "command_audit", maxAge: 14 * day },
  ];

  const deleted: Record<string, number> = {};

  for (const { table, maxAge } of targets) {
    const cutoff = now - maxAge;
    try {
      const result = await client.execute({
        sql: `DELETE FROM ${table} WHERE timestamp < ?`,
        args: [cutoff],
      });
      deleted[table] = result.rowsAffected;
    } catch {
      deleted[table] = -1; // error
    }
  }

  return { deleted };
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
