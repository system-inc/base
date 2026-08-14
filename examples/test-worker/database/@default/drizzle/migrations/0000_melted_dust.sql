CREATE TABLE `orm_product_categories` (
	`categoryId` int unsigned AUTO_INCREMENT NOT NULL,
	`productId` char(36) NOT NULL,
	CONSTRAINT `orm_product_categories_categoryId_productId_pk` PRIMARY KEY(`categoryId`,`productId`)
);
--> statement-breakpoint
CREATE TABLE `orm_product_tags` (
	`productId` char(36) NOT NULL,
	`tagId` varchar(50) NOT NULL,
	CONSTRAINT `orm_product_tags_productId_tagId_pk` PRIMARY KEY(`productId`,`tagId`)
);
--> statement-breakpoint
CREATE TABLE `orm_book_genre_mapping` (
	`book_id` char(36) NOT NULL,
	`genre_id` char(36) NOT NULL,
	CONSTRAINT `orm_book_genre_mapping_book_id_genre_id_pk` PRIMARY KEY(`book_id`,`genre_id`)
);
--> statement-breakpoint
CREATE TABLE `orm_test_entity` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`age` int NOT NULL,
	`email` varchar(255),
	`status` varchar(50),
	`createdAt` datetime(6) NOT NULL,
	`updatedAt` datetime(6),
	CONSTRAINT `orm_test_entity_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orm_composite_entity` (
	`userId` varchar(36) NOT NULL,
	`projectId` varchar(36) NOT NULL,
	`role` varchar(255) NOT NULL,
	`assignedAt` datetime(6) NOT NULL,
	CONSTRAINT `orm_composite_entity_userId_projectId_pk` PRIMARY KEY(`userId`,`projectId`)
);
--> statement-breakpoint
CREATE TABLE `orm_comment_entity` (
	`id` char(36) NOT NULL,
	`content` text NOT NULL,
	`authorId` char(36) NOT NULL,
	`postId` char(36) NOT NULL,
	`createdAt` datetime(6) NOT NULL,
	`updatedAt` datetime(6),
	CONSTRAINT `orm_comment_entity_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orm_post_entity` (
	`id` char(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`authorId` char(36) NOT NULL,
	`createdAt` datetime(6) NOT NULL,
	`updatedAt` datetime(6),
	CONSTRAINT `orm_post_entity_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orm_user_entity` (
	`id` char(36) NOT NULL,
	`username` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`createdAt` datetime(6) NOT NULL,
	`updatedAt` datetime(6),
	CONSTRAINT `orm_user_entity_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orm_categories` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`description` text,
	`parentId` int,
	`sortOrder` int NOT NULL,
	`isVisible` boolean NOT NULL,
	`createdAt` datetime(6) NOT NULL,
	CONSTRAINT `orm_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `orm_categories_name_unique` UNIQUE(`name`),
	CONSTRAINT `orm_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `orm_orders` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(20) NOT NULL,
	`customerId` int NOT NULL,
	`status` varchar(20) NOT NULL,
	`subtotal` decimal(10,2) NOT NULL,
	`tax` decimal(10,2) NOT NULL,
	`shipping` decimal(10,2) NOT NULL,
	`total` decimal(10,2) NOT NULL,
	`currency` varchar(10) NOT NULL,
	`metadata` json,
	`orderDate` datetime(6) NOT NULL,
	`shippedDate` datetime(6),
	`deliveredDate` datetime(6),
	`createdAt` datetime(6) NOT NULL,
	CONSTRAINT `orm_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orm_orders_orderNumber_unique` UNIQUE(`orderNumber`)
);
--> statement-breakpoint
CREATE TABLE `orm_products` (
	`id` char(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`sku` varchar(50) NOT NULL,
	`vendorCode` varchar(20),
	`description` mediumtext NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`stockQuantity` int NOT NULL,
	`isActive` boolean NOT NULL,
	`status` varchar(20) NOT NULL,
	`weight` float,
	`specifications` json,
	`publishedAt` datetime(6) NOT NULL,
	`createdAt` datetime(6) NOT NULL,
	`updatedAt` datetime(6),
	CONSTRAINT `orm_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `orm_products_sku_unique` UNIQUE(`sku`),
	CONSTRAINT `uq_sku_vendor` UNIQUE(`sku`,`vendorCode`)
);
--> statement-breakpoint
CREATE TABLE `orm_tags` (
	`name` varchar(50) NOT NULL,
	`color` varchar(7) NOT NULL,
	`usageCount` int NOT NULL,
	CONSTRAINT `orm_tags_name` PRIMARY KEY(`name`)
);
--> statement-breakpoint
CREATE TABLE `orm_articles` (
	`id` char(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`writer_id` char(36) NOT NULL,
	`createdAt` datetime(6) NOT NULL,
	`updatedAt` datetime(6),
	CONSTRAINT `orm_articles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orm_authors` (
	`id` char(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`email` varchar(255) NOT NULL,
	`code` varchar(50) NOT NULL,
	`createdAt` datetime(6) NOT NULL,
	`updatedAt` datetime(6),
	CONSTRAINT `orm_authors_id` PRIMARY KEY(`id`),
	CONSTRAINT `orm_authors_email_unique` UNIQUE(`email`),
	CONSTRAINT `orm_authors_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `orm_books` (
	`id` char(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`isbn` varchar(13) NOT NULL,
	`pages` int NOT NULL,
	`createdAt` datetime(6) NOT NULL,
	`updatedAt` datetime(6),
	CONSTRAINT `orm_books_id` PRIMARY KEY(`id`),
	CONSTRAINT `orm_books_isbn_unique` UNIQUE(`isbn`)
);
--> statement-breakpoint
CREATE TABLE `orm_genres` (
	`id` char(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`createdAt` datetime(6) NOT NULL,
	`updatedAt` datetime(6),
	CONSTRAINT `orm_genres_id` PRIMARY KEY(`id`),
	CONSTRAINT `orm_genres_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE INDEX `idx_order_date` ON `orm_orders` (`orderDate`);--> statement-breakpoint
CREATE INDEX `idx_customer_status` ON `orm_orders` (`customerId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_price_status` ON `orm_products` (`price`,`status`);--> statement-breakpoint
CREATE INDEX `idx_sku` ON `orm_products` (`sku`);