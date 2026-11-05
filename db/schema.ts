import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const workspace = sqliteTable("workspace", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  createdAt: integer("created_at").notNull(),
  workerToken: text("worker_token"),
  workerUntil: integer("worker_until").notNull().default(0),
});
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  company: text("company").notNull(),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  brief: text("brief").notNull(),
  criteria: text("criteria").notNull().default(""),
  reference: text("reference").notNull().default(""),
  issueUrl: text("issue_url").notNull().default(""),
  status: text("status").notNull().default("requested"),
  approvedVersion: text("approved_version"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  createdBy: text("created_by").notNull(),
});
export const versions = sqliteTable(
  "versions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    number: integer("number").notNull(),
    label: text("label").notNull(),
    source: text("source").notNull(),
    storageKey: text("storage_key").notNull(),
    digest: text("digest").notNull(),
    prompt: text("prompt").notNull(),
    createdAt: integer("created_at").notNull(),
    createdBy: text("created_by").notNull(),
  },
  (t) => [uniqueIndex("version_number").on(t.projectId, t.number)],
);
export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    mode: text("mode").notNull(),
    prompt: text("prompt").notNull(),
    status: text("status").notNull(),
    phase: text("phase").notNull(),
    error: text("error"),
    lease: text("lease"),
    providerId: text("provider_id"),
    actor: text("actor").notNull(),
    createdAt: integer("created_at").notNull(),
    startedAt: integer("started_at"),
    finishedAt: integer("finished_at"),
  },
  (t) => [
    index("queue_order").on(t.status, t.createdAt),
    uniqueIndex("one_active_build")
      .on(t.status)
      .where(sql`${t.status} = 'running'`),
    uniqueIndex("one_pending_per_project")
      .on(t.projectId)
      .where(sql`${t.status} IN ('queued', 'running')`),
  ],
);
export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    versionId: text("version_id")
      .notNull()
      .references(() => versions.id),
    body: text("body").notNull(),
    author: text("author").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("project_comments").on(t.projectId, t.createdAt)],
);
export const activity = sqliteTable(
  "activity",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    text: text("text").notNull(),
    actor: text("actor").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("project_activity").on(t.projectId, t.createdAt)],
);
export const invitations = sqliteTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    versionId: text("version_id")
      .notNull()
      .references(() => versions.id),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    revokedAt: integer("revoked_at"),
  },
  (t) => [
    uniqueIndex("invitations_token_hash").on(t.tokenHash),
    index("version_invitations").on(t.versionId, t.createdAt),
  ],
);
export const settings = sqliteTable("settings", {
  id: text("id").primaryKey(),
  value: text("value").notNull(),
});
