ALTER TABLE `stories` ADD `draftStatus` enum('planned','drafting','revising','complete') DEFAULT 'drafting' NOT NULL;--> statement-breakpoint
ALTER TABLE `stories` ADD `synopsis` text;