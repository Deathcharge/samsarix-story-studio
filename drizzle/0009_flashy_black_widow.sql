CREATE TABLE `storyScenes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storyId` int NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`summary` text NOT NULL,
	`position` int NOT NULL,
	`pov` varchar(255),
	`location` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `storyScenes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `storyScenes` ADD CONSTRAINT `storyScenes_storyId_stories_id_fk` FOREIGN KEY (`storyId`) REFERENCES `stories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `storyScenes` ADD CONSTRAINT `storyScenes_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `storyScenes` ADD CONSTRAINT `storyScenes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX `storyScenes_story_position_idx` ON `storyScenes` (`storyId`,`position`);--> statement-breakpoint
CREATE INDEX `storyScenes_project_user_idx` ON `storyScenes` (`projectId`,`userId`);
