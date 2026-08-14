PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_orm_product_categories` (
	`productId` text NOT NULL,
	`categoryId` integer NOT NULL,
	PRIMARY KEY(`productId`, `categoryId`)
);
--> statement-breakpoint
INSERT INTO `__new_orm_product_categories`("productId", "categoryId") SELECT "productId", "categoryId" FROM `orm_product_categories`;--> statement-breakpoint
DROP TABLE `orm_product_categories`;--> statement-breakpoint
ALTER TABLE `__new_orm_product_categories` RENAME TO `orm_product_categories`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_orm_articles` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`writer_id` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_orm_articles`("id", "title", "content", "writer_id", "createdAt", "updatedAt") SELECT "id", "title", "content", "writer_id", "createdAt", "updatedAt" FROM `orm_articles`;--> statement-breakpoint
DROP TABLE `orm_articles`;--> statement-breakpoint
ALTER TABLE `__new_orm_articles` RENAME TO `orm_articles`;--> statement-breakpoint
CREATE TABLE `__new_orm_authors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`code` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_orm_authors`("id", "name", "email", "code", "createdAt", "updatedAt") SELECT "id", "name", "email", "code", "createdAt", "updatedAt" FROM `orm_authors`;--> statement-breakpoint
DROP TABLE `orm_authors`;--> statement-breakpoint
ALTER TABLE `__new_orm_authors` RENAME TO `orm_authors`;--> statement-breakpoint
CREATE UNIQUE INDEX `orm_authors_email_unique` ON `orm_authors` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `orm_authors_code_unique` ON `orm_authors` (`code`);--> statement-breakpoint
CREATE TABLE `__new_orm_books` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`isbn` text NOT NULL,
	`pages` integer NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_orm_books`("id", "title", "isbn", "pages", "createdAt", "updatedAt") SELECT "id", "title", "isbn", "pages", "createdAt", "updatedAt" FROM `orm_books`;--> statement-breakpoint
DROP TABLE `orm_books`;--> statement-breakpoint
ALTER TABLE `__new_orm_books` RENAME TO `orm_books`;--> statement-breakpoint
CREATE UNIQUE INDEX `orm_books_isbn_unique` ON `orm_books` (`isbn`);--> statement-breakpoint
CREATE TABLE `__new_orm_comment_entity` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`authorId` text NOT NULL,
	`postId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_orm_comment_entity`("id", "content", "authorId", "postId", "createdAt", "updatedAt") SELECT "id", "content", "authorId", "postId", "createdAt", "updatedAt" FROM `orm_comment_entity`;--> statement-breakpoint
DROP TABLE `orm_comment_entity`;--> statement-breakpoint
ALTER TABLE `__new_orm_comment_entity` RENAME TO `orm_comment_entity`;--> statement-breakpoint
CREATE TABLE `__new_orm_genres` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_orm_genres`("id", "name", "description", "createdAt", "updatedAt") SELECT "id", "name", "description", "createdAt", "updatedAt" FROM `orm_genres`;--> statement-breakpoint
DROP TABLE `orm_genres`;--> statement-breakpoint
ALTER TABLE `__new_orm_genres` RENAME TO `orm_genres`;--> statement-breakpoint
CREATE UNIQUE INDEX `orm_genres_name_unique` ON `orm_genres` (`name`);--> statement-breakpoint
CREATE TABLE `__new_orm_post_entity` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`authorId` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_orm_post_entity`("id", "title", "content", "authorId", "createdAt", "updatedAt") SELECT "id", "title", "content", "authorId", "createdAt", "updatedAt" FROM `orm_post_entity`;--> statement-breakpoint
DROP TABLE `orm_post_entity`;--> statement-breakpoint
ALTER TABLE `__new_orm_post_entity` RENAME TO `orm_post_entity`;--> statement-breakpoint
CREATE TABLE `__new_orm_products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sku` text NOT NULL,
	`vendorCode` text,
	`description` text DEFAULT 'No description available' NOT NULL,
	`price` real DEFAULT 99.99 NOT NULL,
	`stockQuantity` integer DEFAULT 10 NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`weight` real DEFAULT 0,
	`specifications` text,
	`publishedAt` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_orm_products`("id", "name", "sku", "vendorCode", "description", "price", "stockQuantity", "isActive", "status", "weight", "specifications", "publishedAt", "createdAt", "updatedAt") SELECT "id", "name", "sku", "vendorCode", "description", "price", "stockQuantity", "isActive", "status", "weight", "specifications", "publishedAt", "createdAt", "updatedAt" FROM `orm_products`;--> statement-breakpoint
DROP TABLE `orm_products`;--> statement-breakpoint
ALTER TABLE `__new_orm_products` RENAME TO `orm_products`;--> statement-breakpoint
CREATE UNIQUE INDEX `orm_products_sku_unique` ON `orm_products` (`sku`);--> statement-breakpoint
CREATE INDEX `idx_price_status` ON `orm_products` (`price`,`status`);--> statement-breakpoint
CREATE INDEX `idx_sku` ON `orm_products` (`sku`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_sku_vendor` ON `orm_products` (`sku`,`vendorCode`);--> statement-breakpoint
CREATE TABLE `__new_orm_test_entity` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`age` integer NOT NULL,
	`email` text,
	`status` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_orm_test_entity`("id", "name", "age", "email", "status", "createdAt", "updatedAt") SELECT "id", "name", "age", "email", "status", "createdAt", "updatedAt" FROM `orm_test_entity`;--> statement-breakpoint
DROP TABLE `orm_test_entity`;--> statement-breakpoint
ALTER TABLE `__new_orm_test_entity` RENAME TO `orm_test_entity`;--> statement-breakpoint
CREATE TABLE `__new_orm_user_entity` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_orm_user_entity`("id", "username", "email", "createdAt", "updatedAt") SELECT "id", "username", "email", "createdAt", "updatedAt" FROM `orm_user_entity`;--> statement-breakpoint
DROP TABLE `orm_user_entity`;--> statement-breakpoint
ALTER TABLE `__new_orm_user_entity` RENAME TO `orm_user_entity`;