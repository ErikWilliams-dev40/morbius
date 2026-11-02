CREATE TABLE `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`text` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `project_activity` ON `activity` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`version_id` text NOT NULL,
	`body` text NOT NULL,
	`author` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`version_id`) REFERENCES `versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `project_comments` ON `comments` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`mode` text NOT NULL,
	`prompt` text NOT NULL,
	`status` text NOT NULL,
	`phase` text NOT NULL,
	`error` text,
	`lease` text,
	`provider_id` text,
	`actor` text NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `queue_order` ON `jobs` (`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `one_active_build` ON `jobs` (`status`) WHERE "jobs"."status" = 'running';--> statement-breakpoint
CREATE UNIQUE INDEX `one_pending_per_project` ON `jobs` (`project_id`) WHERE "jobs"."status" IN ('queued', 'running');--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`company` text NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`brief` text NOT NULL,
	`criteria` text DEFAULT '' NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`approved_version` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `versions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`number` integer NOT NULL,
	`label` text NOT NULL,
	`source` text NOT NULL,
	`storage_key` text NOT NULL,
	`digest` text NOT NULL,
	`prompt` text NOT NULL,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `version_number` ON `versions` (`project_id`,`number`);--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`created_at` integer NOT NULL,
	`worker_token` text,
	`worker_until` integer DEFAULT 0 NOT NULL
);
