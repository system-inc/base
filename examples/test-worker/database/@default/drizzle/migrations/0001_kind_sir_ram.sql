ALTER TABLE `orm_categories` MODIFY COLUMN `sortOrder` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `orm_categories` MODIFY COLUMN `isVisible` boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE `orm_orders` MODIFY COLUMN `status` varchar(20) NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `orm_orders` MODIFY COLUMN `subtotal` decimal(10,2) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `orm_orders` MODIFY COLUMN `tax` decimal(10,2) NOT NULL DEFAULT 8.5;--> statement-breakpoint
ALTER TABLE `orm_orders` MODIFY COLUMN `shipping` decimal(10,2) NOT NULL DEFAULT 12;--> statement-breakpoint
ALTER TABLE `orm_orders` MODIFY COLUMN `currency` varchar(10) NOT NULL DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE `orm_products` MODIFY COLUMN `description` varchar(512) NOT NULL DEFAULT 'No description available';--> statement-breakpoint
ALTER TABLE `orm_products` MODIFY COLUMN `price` decimal(10,2) NOT NULL DEFAULT 99.99;--> statement-breakpoint
ALTER TABLE `orm_products` MODIFY COLUMN `stockQuantity` int NOT NULL DEFAULT 10;--> statement-breakpoint
ALTER TABLE `orm_products` MODIFY COLUMN `isActive` boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE `orm_products` MODIFY COLUMN `status` varchar(20) NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `orm_products` MODIFY COLUMN `weight` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `orm_tags` MODIFY COLUMN `color` varchar(7) NOT NULL DEFAULT '#000000';--> statement-breakpoint
ALTER TABLE `orm_tags` MODIFY COLUMN `usageCount` int NOT NULL DEFAULT 0;