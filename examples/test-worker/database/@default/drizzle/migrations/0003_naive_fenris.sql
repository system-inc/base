ALTER TABLE `orm_product_categories` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `orm_articles` MODIFY COLUMN `updatedAt` datetime(6) NOT NULL;--> statement-breakpoint
ALTER TABLE `orm_authors` MODIFY COLUMN `updatedAt` datetime(6) NOT NULL;--> statement-breakpoint
ALTER TABLE `orm_book_genre_mapping` MODIFY COLUMN `book_id` varchar(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `orm_book_genre_mapping` MODIFY COLUMN `genre_id` varchar(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `orm_books` MODIFY COLUMN `updatedAt` datetime(6) NOT NULL;--> statement-breakpoint
ALTER TABLE `orm_comment_entity` MODIFY COLUMN `updatedAt` datetime(6) NOT NULL;--> statement-breakpoint
ALTER TABLE `orm_genres` MODIFY COLUMN `updatedAt` datetime(6) NOT NULL;--> statement-breakpoint
ALTER TABLE `orm_post_entity` MODIFY COLUMN `updatedAt` datetime(6) NOT NULL;--> statement-breakpoint
ALTER TABLE `orm_product_categories` MODIFY COLUMN `categoryId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `orm_product_categories` MODIFY COLUMN `productId` varchar(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `orm_product_tags` MODIFY COLUMN `productId` varchar(36) NOT NULL;--> statement-breakpoint
ALTER TABLE `orm_products` MODIFY COLUMN `updatedAt` datetime(6) NOT NULL;--> statement-breakpoint
ALTER TABLE `orm_test_entity` MODIFY COLUMN `updatedAt` datetime(6) NOT NULL;--> statement-breakpoint
ALTER TABLE `orm_user_entity` MODIFY COLUMN `updatedAt` datetime(6) NOT NULL;--> statement-breakpoint
ALTER TABLE `orm_product_categories` ADD PRIMARY KEY(`productId`,`categoryId`);