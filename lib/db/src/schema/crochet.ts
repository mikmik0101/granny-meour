import {
  boolean,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const categoriesTable = pgTable("crochet_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const productsTable = pgTable("crochet_products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
  image: text("image").notNull(),
  additionalImages: text("additional_images").array().notNull().default([]),
  status: text("status").notNull().default("available"),
  featured: boolean("featured").notNull().default(false),
  colors: text("colors").array().notNull().default([]),
  variants: text("variants").array().notNull().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const settingsTable = pgTable("crochet_settings", {
  id: serial("id").primaryKey(),
  brandName: text("brand_name").notNull(),
  logo: text("logo"),
  heroTitle: text("hero_title").notNull(),
  heroSubtitle: text("hero_subtitle").notNull(),
  heroDescription: text("hero_description").notNull(),
  aboutTitle: text("about_title").notNull(),
  aboutContent: text("about_content").notNull(),
  contactMethods: text("contact_methods").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({
  id: true,
  createdAt: true,
});
export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertSettingsSchema = createInsertSchema(settingsTable).omit({
  id: true,
  updatedAt: true,
});

export type Category = typeof categoriesTable.$inferSelect;
export type Product = typeof productsTable.$inferSelect;
export type Settings = typeof settingsTable.$inferSelect;
export const productStatusSchema = z.enum([
  "available",
  "sold-out",
  "coming-soon",
  "hidden",
]);