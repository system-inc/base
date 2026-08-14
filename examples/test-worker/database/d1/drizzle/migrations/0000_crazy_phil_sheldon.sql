CREATE TABLE `orm_product_categories` (
	`categoryId` integer NOT NULL,
	`productId` text NOT NULL,
	PRIMARY KEY(`categoryId`, `productId`)
);
--> statement-breakpoint
CREATE TABLE `orm_product_tags` (
	`productId` text NOT NULL,
	`tagId` text NOT NULL,
	PRIMARY KEY(`productId`, `tagId`)
);
--> statement-breakpoint
CREATE TABLE `orm_book_genre_mapping` (
	`book_id` text NOT NULL,
	`genre_id` text NOT NULL,
	PRIMARY KEY(`book_id`, `genre_id`)
);
--> statement-breakpoint
CREATE TABLE `orm_test_entity` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`age` integer NOT NULL,
	`email` text,
	`status` text,
	`createdAt` text NOT NULL,
	`updatedAt` text
);
--> statement-breakpoint
CREATE TABLE `orm_composite_entity` (
	`userId` text NOT NULL,
	`projectId` text NOT NULL,
	`role` text NOT NULL,
	`assignedAt` text NOT NULL,
	PRIMARY KEY(`userId`, `projectId`)
);
--> statement-breakpoint
CREATE TABLE `orm_comment_entity` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`authorId` text NOT NULL,
	`postId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text
);
--> statement-breakpoint
CREATE TABLE `orm_post_entity` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`authorId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text
);
--> statement-breakpoint
CREATE TABLE `orm_user_entity` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text
);
--> statement-breakpoint
CREATE TABLE `orm_categories` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`parentId` integer,
	`sortOrder` integer NOT NULL,
	`isVisible` integer NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orm_categories_name_unique` ON `orm_categories` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `orm_categories_slug_unique` ON `orm_categories` (`slug`);--> statement-breakpoint
CREATE TABLE `orm_orders` (
	`id` integer PRIMARY KEY NOT NULL,
	`orderNumber` text NOT NULL,
	`customerId` integer NOT NULL,
	`status` text NOT NULL,
	`subtotal` real NOT NULL,
	`tax` real NOT NULL,
	`shipping` real NOT NULL,
	`total` real NOT NULL,
	`currency` text NOT NULL,
	`metadata` text,
	`orderDate` text NOT NULL,
	`shippedDate` text,
	`deliveredDate` text,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orm_orders_orderNumber_unique` ON `orm_orders` (`orderNumber`);--> statement-breakpoint
CREATE INDEX `idx_order_date` ON `orm_orders` (`orderDate`);--> statement-breakpoint
CREATE INDEX `idx_customer_status` ON `orm_orders` (`customerId`,`status`);--> statement-breakpoint
CREATE TABLE `orm_products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sku` text NOT NULL,
	`vendorCode` text,
	`description` text NOT NULL,
	`price` real NOT NULL,
	`stockQuantity` integer NOT NULL,
	`isActive` integer NOT NULL,
	`status` text NOT NULL,
	`weight` real,
	`specifications` text,
	`publishedAt` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orm_products_sku_unique` ON `orm_products` (`sku`);--> statement-breakpoint
CREATE INDEX `idx_price_status` ON `orm_products` (`price`,`status`);--> statement-breakpoint
CREATE INDEX `idx_sku` ON `orm_products` (`sku`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_sku_vendor` ON `orm_products` (`sku`,`vendorCode`);--> statement-breakpoint
CREATE TABLE `orm_tags` (
	`name` text PRIMARY KEY NOT NULL,
	`color` text NOT NULL,
	`usageCount` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orm_articles` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`writer_id` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text
);
--> statement-breakpoint
CREATE TABLE `orm_authors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`code` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orm_authors_email_unique` ON `orm_authors` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `orm_authors_code_unique` ON `orm_authors` (`code`);--> statement-breakpoint
CREATE TABLE `orm_books` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`isbn` text NOT NULL,
	`pages` integer NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orm_books_isbn_unique` ON `orm_books` (`isbn`);--> statement-breakpoint
CREATE TABLE `orm_genres` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`createdAt` text NOT NULL,
	`updatedAt` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orm_genres_name_unique` ON `orm_genres` (`name`);--> statement-breakpoint
CREATE TABLE `RateLimiterEntry` (
	`key` blob PRIMARY KEY NOT NULL,
	`createdAt` text NOT NULL,
	`timestamps` text NOT NULL,
	`updatedAt` blob NOT NULL
);
