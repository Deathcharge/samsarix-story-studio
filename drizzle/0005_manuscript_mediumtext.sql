ALTER TABLE `stories` MODIFY COLUMN `content` mediumtext NOT NULL;--> statement-breakpoint
ALTER TABLE `storyRevisions` MODIFY COLUMN `content` mediumtext NOT NULL;