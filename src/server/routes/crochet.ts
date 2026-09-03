import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { clerkClient } from "@clerk/express";
import {
  CreateCategoryBody,
  CreateProductBody,
  CreateProductResponse,
  GetDashboardResponse,
  GetProductParams,
  GetProductResponse,
  GetSettingsResponse,
  ListCategoriesResponse,
  ListProductsQueryParams,
  ListProductsResponse,
  UpdateCategoryBody,
  UpdateCategoryParams,
  UpdateProductBody,
  UpdateProductParams,
  UpdateSettingsBody,
} from "@shared/zod";
import { db } from "@shared/db";
import {
  categoriesTable,
  productsTable,
  settingsTable,
} from "@shared/db/schema";

const router: IRouter = Router();

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  const authReq = req as Request & { auth?: () => { userId?: string | null } };
  const userId = typeof authReq.auth === "function" ? authReq.auth().userId : null;
  const allowedEmail = process.env.CROCHET_ADMIN_EMAIL?.trim().toLowerCase();
  if (!userId || !allowedEmail) {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  const user = await clerkClient.users.getUser(userId);
  const primaryEmail = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  )?.emailAddress.trim().toLowerCase();
  if (primaryEmail !== allowedEmail) {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

router.get("/admin/access", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  res.json({ allowed: true });
});

const fallbackSettings = {
  brandName: "Granny Meour",
  logo: null,
  heroTitle: "Handmade with love",
  heroSubtitle: "Little crochet creations, made one stitch at a time.",
  heroDescription:
    "Soft, joyful pieces for gifting, collecting, and making everyday moments feel a little more special.",
  aboutTitle: "Made slowly, with a whole lot of heart",
  aboutContent:
    "This space is a little home for handmade crochet treasures. The story, process, and inspirations behind each piece will be added here soon.",
  contactMethods: [
    {
      id: "instagram",
      platform: "instagram",
      label: "Instagram",
      description: "See the newest stitches and behind-the-scenes moments.",
      value: "",
      enabled: false,
    },
    {
      id: "messenger",
      platform: "messenger",
      label: "Messenger",
      description: "Send a note about a piece you love.",
      value: "",
      enabled: false,
    },
    {
      id: "email",
      platform: "email",
      label: "Email",
      description: "For custom questions and sweet hellos.",
      value: "",
      enabled: false,
    },
  ],
};

function toProduct(row: typeof productsTable.$inferSelect) {
  return {
    ...row,
    price: Number(row.price),
    notes: row.notes ?? null,
    additionalImages: row.additionalImages ?? [],
    colors: row.colors ?? [],
    variants: row.variants ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function ensureSeeded() {
  const existing = await db.select({ id: productsTable.id }).from(productsTable).limit(1);
  if (existing.length) return;
  const cats = await db.insert(categoriesTable).values([
    { name: "Stuffed Toys" },
    { name: "Bags" },
    { name: "Accessories" },
    { name: "Flowers" },
  ]).returning();
  await db.insert(productsTable).values([
    {
      name: "Bunny Bloom",
      description: "A cuddly little bunny with a flower tucked by her ear.",
      price: "850",
      category: cats[0]?.name ?? "Stuffed Toys",
      image: "https://images.unsplash.com/photo-1559454403-b8fb88521f11?auto=format&fit=crop&w=900&q=85",
      featured: true,
      status: "available",
      colors: ["Cream", "Blush"],
      variants: ["Small"],
    },
    {
      name: "Petal Pouch",
      description: "A tiny scalloped pouch for the little things you carry every day.",
      price: "620",
      category: cats[1]?.name ?? "Bags",
      image: "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=900&q=85",
      featured: true,
      status: "available",
      colors: ["Rose", "Butter"],
      variants: ["Zip pouch"],
    },
    {
      name: "Daisy Clip",
      description: "A cheerful crochet flower clip to brighten up a bag or a bun.",
      price: "280",
      category: cats[2]?.name ?? "Accessories",
      image: "https://images.unsplash.com/photo-1528357136257-0c25517acfea?auto=format&fit=crop&w=900&q=85",
      featured: true,
      status: "coming-soon",
      colors: ["Ivory", "Sunshine"],
      variants: ["Single flower"],
    },
  ]);
  await db.insert(settingsTable).values({
    ...fallbackSettings,
    contactMethods: JSON.stringify(fallbackSettings.contactMethods),
  });
}

async function getSettings() {
  await ensureSeeded();
  const rows = await db.select().from(settingsTable).limit(1);
  const row = rows[0];
  if (!row) return fallbackSettings;
  return {
    brandName: row.brandName,
    logo: row.logo,
    heroTitle: row.heroTitle,
    heroSubtitle: row.heroSubtitle,
    heroDescription: row.heroDescription,
    aboutTitle: row.aboutTitle,
    aboutContent: row.aboutContent,
    contactMethods: JSON.parse(row.contactMethods),
  };
}

router.get("/products", async (req, res) => {
  await ensureSeeded();
  const query = ListProductsQueryParams.parse(req.query);
  const filters = [sql`${productsTable.status} <> 'hidden'`];
  if (query.search) {
    filters.push(or(ilike(productsTable.name, `%${query.search}%`), ilike(productsTable.description, `%${query.search}%`))!);
  }
  if (query.category && query.category !== "All") filters.push(eq(productsTable.category, query.category));
  let orderBy = desc(productsTable.createdAt);
  if (query.sort === "price-low") orderBy = asc(productsTable.price);
  if (query.sort === "price-high") orderBy = desc(productsTable.price);
  if (query.sort === "name") orderBy = asc(productsTable.name);
  const rows = await db.select().from(productsTable).where(and(...filters)).orderBy(orderBy);
  res.json(ListProductsResponse.parse(rows.map(toProduct)));
});

router.get("/products/:id", async (req, res) => {
  const { id } = GetProductParams.parse({ id: Number(req.params.id) });
  const rows = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  const row = rows[0];
  if (!row || row.status === "hidden") return res.status(404).json({ error: "Product not found" });
  return res.json(GetProductResponse.parse(toProduct(row)));
});

router.post("/products", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const data = CreateProductBody.parse(req.body);
  const rows = await db.insert(productsTable).values({
    ...data,
    price: String(data.price),
    additionalImages: data.additionalImages ?? [],
    colors: data.colors ?? [],
    variants: data.variants ?? [],
    status: data.status ?? "available",
    featured: data.featured ?? false,
    notes: data.notes ?? null,
  }).returning();
  res.status(201).json(CreateProductResponse.parse(toProduct(rows[0]!)));
});

router.patch("/products/:id", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { id } = UpdateProductParams.parse({ id: Number(req.params.id) });
  const data = UpdateProductBody.parse(req.body);
  const rows = await db.update(productsTable).set({
    ...data,
    price: data.price === undefined ? undefined : String(data.price),
    updatedAt: new Date(),
  }).where(eq(productsTable.id, id)).returning();
  const row = rows[0];
  if (!row) return res.status(404).json({ error: "Product not found" });
  return res.json(toProduct(row));
});

router.delete("/products/:id", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  await db.delete(productsTable).where(eq(productsTable.id, Number(req.params.id)));
  res.status(204).send();
});

router.get("/categories", async (_req, res) => {
  await ensureSeeded();
  const rows = await db.select({
    id: categoriesTable.id,
    name: categoriesTable.name,
    productCount: sql<number>`count(${productsTable.id})::int`,
  }).from(categoriesTable).leftJoin(productsTable, eq(categoriesTable.name, productsTable.category)).groupBy(categoriesTable.id).orderBy(asc(categoriesTable.name));
  res.json(ListCategoriesResponse.parse(rows));
});

router.post("/categories", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const data = CreateCategoryBody.parse(req.body);
  const rows = await db.insert(categoriesTable).values(data).returning();
  res.status(201).json({ ...rows[0], productCount: 0 });
});

router.patch("/categories/:id", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { id } = UpdateCategoryParams.parse({ id: Number(req.params.id) });
  const data = UpdateCategoryBody.parse(req.body);
  const current = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id)).limit(1);
  if (!current[0]) return res.status(404).json({ error: "Category not found" });
  const rows = await db.update(categoriesTable).set(data).where(eq(categoriesTable.id, id)).returning();
  await db.update(productsTable).set({ category: data.name, updatedAt: new Date() }).where(eq(productsTable.category, current[0].name));
  return res.json({ ...rows[0], productCount: 0 });
});

router.delete("/categories/:id", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const current = await db.select().from(categoriesTable).where(eq(categoriesTable.id, Number(req.params.id))).limit(1);
  if (current[0]) {
    const count = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(eq(productsTable.category, current[0].name));
    if ((count[0]?.count ?? 0) > 0) return res.status(409).json({ error: "Reassign products before deleting this category." });
  }
  await db.delete(categoriesTable).where(eq(categoriesTable.id, Number(req.params.id)));
  return res.status(204).send();
});

router.get("/settings", async (_req, res) => {
  res.json(GetSettingsResponse.parse(await getSettings()));
});

router.patch("/settings", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const data = UpdateSettingsBody.parse(req.body);
  await ensureSeeded();
  const existing = await db.select({ id: settingsTable.id }).from(settingsTable).limit(1);
  const rows = existing[0]
    ? await db.update(settingsTable).set({
        ...data,
        contactMethods: JSON.stringify(data.contactMethods),
        updatedAt: new Date(),
      }).where(eq(settingsTable.id, existing[0].id)).returning()
    : await db.insert(settingsTable).values({
        ...data,
        contactMethods: JSON.stringify(data.contactMethods),
      }).returning();
  res.json(await getSettings());
});

router.get("/admin/dashboard", async (_req, res) => {
  await ensureSeeded();
  const rows = await db.select({ status: productsTable.status, featured: productsTable.featured, count: sql<number>`count(*)::int` }).from(productsTable).groupBy(productsTable.status, productsTable.featured);
  const categories = await db.select({ count: sql<number>`count(*)::int` }).from(categoriesTable);
  const totalProducts = rows.reduce((sum: number, row: any) => sum + row.count, 0);
  res.json(GetDashboardResponse.parse({
    totalProducts,
    availableProducts: rows.filter((r: any) => r.status === "available").reduce((s: number, r: any) => s + r.count, 0),
    soldOutProducts: rows.filter((r: any) => r.status === "sold-out").reduce((s: number, r: any) => s + r.count, 0),
    hiddenProducts: rows.filter((r: any) => r.status === "hidden").reduce((s: number, r: any) => s + r.count, 0),
    featuredProducts: rows.filter((r: any) => r.featured).reduce((s: number, r: any) => s + r.count, 0),
    totalCategories: categories[0]?.count ?? 0,
  }));
});

export default router;