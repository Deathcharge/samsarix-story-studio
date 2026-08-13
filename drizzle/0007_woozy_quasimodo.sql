CREATE TABLE `generationJobs` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`storyId` int,
	`ritualId` varchar(64),
	`mode` enum('demo','provider') NOT NULL,
	`status` enum('queued','running','cancelling','succeeded','failed','cancelled','interrupted') NOT NULL,
	`stage` enum('queued','preparing','plot','characters','world','twists','research','synthesis','review','saving','completed') NOT NULL,
	`stageLabel` varchar(255) NOT NULL,
	`progress` int NOT NULL DEFAULT 0,
	`cancelRequested` int NOT NULL DEFAULT 0,
	`errorMessage` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `generationJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `generationJobs` ADD CONSTRAINT `generationJobs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `generationJobs` ADD CONSTRAINT `generationJobs_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `generationJobs` ADD CONSTRAINT `generationJobs_storyId_stories_id_fk` FOREIGN KEY (`storyId`) REFERENCES `stories`(`id`) ON DELETE no action ON UPDATE no action;