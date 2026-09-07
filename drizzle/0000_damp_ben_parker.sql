CREATE TABLE "crochet_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "crochet_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "crochet_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"category" text NOT NULL,
	"image" text NOT NULL,
	"additional_images" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"colors" text[] DEFAULT '{}' NOT NULL,
	"variants" text[] DEFAULT '{}' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crochet_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_name" text NOT NULL,
	"logo" text,
	"hero_title" text NOT NULL,
	"hero_subtitle" text NOT NULL,
	"hero_description" text NOT NULL,
	"about_title" text NOT NULL,
	"about_content" text NOT NULL,
	"contact_methods" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
