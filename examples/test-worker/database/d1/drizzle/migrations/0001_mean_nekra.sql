DROP TABLE `RateLimiterEntry`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_orm_categories` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`parentId` integer,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`isVisible` integer DEFAULT true NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_orm_categories`("id", "name", "slug", "description", "parentId", "sortOrder", "isVisible", "createdAt") SELECT "id", "name", "slug", "description", "parentId", "sortOrder", "isVisible", "createdAt" FROM `orm_categories`;--> statement-breakpoint
DROP TABLE `orm_categories`;--> statement-breakpoint
ALTER TABLE `__new_orm_categories` RENAME TO `orm_categories`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `orm_categories_name_unique` ON `orm_categories` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `orm_categories_slug_unique` ON `orm_categories` (`slug`);--> statement-breakpoint
CREATE TABLE `__new_orm_orders` (
	`id` integer PRIMARY KEY NOT NULL,
	`orderNumber` text NOT NULL,
	`customerId` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	`tax` real DEFAULT 8.5 NOT NULL,
	`shipping` real DEFAULT 12 NOT NULL,
	`total` real NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`metadata` text,
	`orderDate` text NOT NULL,
	`shippedDate` text,
	`deliveredDate` text,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_orm_orders`("id", "orderNumber", "customerId", "status", "subtotal", "tax", "shipping", "total", "currency", "metadata", "orderDate", "shippedDate", "deliveredDate", "createdAt") SELECT "id", "orderNumber", "customerId", "status", "subtotal", "tax", "shipping", "total", "currency", "metadata", "orderDate", "shippedDate", "deliveredDate", "createdAt" FROM `orm_orders`;--> statement-breakpoint
DROP TABLE `orm_orders`;--> statement-breakpoint
ALTER TABLE `__new_orm_orders` RENAME TO `orm_orders`;--> statement-breakpoint
CREATE UNIQUE INDEX `orm_orders_orderNumber_unique` ON `orm_orders` (`orderNumber`);--> statement-breakpoint
CREATE INDEX `idx_order_date` ON `orm_orders` (`orderDate`);--> statement-breakpoint
CREATE INDEX `idx_customer_status` ON `orm_orders` (`customerId`,`status`);--> statement-breakpoint
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
	`updatedAt` text
);
--> statement-breakpoint
INSERT INTO `__new_orm_products`("id", "name", "sku", "vendorCode", "description", "price", "stockQuantity", "isActive", "status", "weight", "specifications", "publishedAt", "createdAt", "updatedAt") SELECT "id", "name", "sku", "vendorCode", "description", "price", "stockQuantity", "isActive", "status", "weight", "specifications", "publishedAt", "createdAt", "updatedAt" FROM `orm_products`;--> statement-breakpoint
DROP TABLE `orm_products`;--> statement-breakpoint
ALTER TABLE `__new_orm_products` RENAME TO `orm_products`;--> statement-breakpoint
CREATE UNIQUE INDEX `orm_products_sku_unique` ON `orm_products` (`sku`);--> statement-breakpoint
CREATE INDEX `idx_price_status` ON `orm_products` (`price`,`status`);--> statement-breakpoint
CREATE INDEX `idx_sku` ON `orm_products` (`sku`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_sku_vendor` ON `orm_products` (`sku`,`vendorCode`);--> statement-breakpoint
CREATE TABLE `__new_orm_tags` (
	`name` text PRIMARY KEY NOT NULL,
	`color` text DEFAULT '#000000' NOT NULL,
	`usageCount` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_orm_tags`("name", "color", "usageCount") SELECT "name", "color", "usageCount" FROM `orm_tags`;--> statement-breakpoint
DROP TABLE `orm_tags`;--> statement-breakpoint
ALTER TABLE `__new_orm_tags` RENAME TO `orm_tags`;