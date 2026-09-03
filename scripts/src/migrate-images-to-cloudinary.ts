import { v2 as cloudinary } from 'cloudinary';
import { db } from '@workspace/db';
import { productsTable } from '@workspace/db/schema';
import { eq } from 'drizzle-orm';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  console.error('ERROR: Cloudinary configuration missing.');
  console.error('Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.');
  process.exit(1);
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

interface ProductImage {
  id: number;
  name: string;
  image: string;
  additionalImages: string[];
}

const REPLIT_STORAGE_PATTERN = /^https:\/\/storage\.googleapis\.com\/|^\/api\/storage\/objects/;

async function uploadBufferToCloudinary(buffer: Buffer, folder: string): Promise<{ secure_url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        overwrite: false,
        unique_filename: true,
      },
      (error, result) => {
        if (error || !result) {
          reject(new Error(`Cloudinary upload failed: ${error?.message || 'Unknown error'}`));
          return;
        }
        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      },
    );
    uploadStream.end(buffer);
  });
}

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
      console.warn(`  Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.warn(`  Failed to fetch ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

function isReplitUrl(url: string): boolean {
  return REPLIT_STORAGE_PATTERN.test(url);
}

function isCloudinaryUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('cloudinary.com');
  } catch {
    return false;
  }
}

async function migrateImage(url: string, folder: string): Promise<string | null> {
  if (!url || url.trim() === '') {
    return null;
  }

  if (isCloudinaryUrl(url)) {
    console.log(`  Already on Cloudinary: ${url}`);
    return url;
  }

  if (!isReplitUrl(url)) {
    console.log(`  External URL (not Replit), keeping as-is: ${url}`);
    return url;
  }

  console.log(`  Migrating from Replit: ${url}`);

  let buffer: Buffer | null = null;

  if (url.startsWith('/api/storage/objects')) {
    console.warn(`  Cannot fetch relative URL ${url} without running server. Skipping.`);
    return url;
  }

  buffer = await fetchImage(url);

  if (!buffer) {
    console.warn(`  Could not download image, keeping original URL`);
    return url;
  }

  try {
    const result = await uploadBufferToCloudinary(buffer, folder);
    console.log(`  ✓ Uploaded to Cloudinary: ${result.secure_url}`);
    return result.secure_url;
  } catch (error) {
    console.error(`  ✗ Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return url;
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const folder = 'crochet-boutique/products';

  console.log('=== Cloudinary Image Migration Script ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`Cloudinary folder: ${folder}`);
  console.log('');

  try {
    const products = await db.select().from(productsTable);
    console.log(`Found ${products.length} products in database`);
    console.log('');

    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    for (const product of products) {
      console.log(`Processing product ${product.id}: ${product.name}`);
      const updates: Record<string, string> = {};
      let productChanged = false;

      // Migrate main image
      if (product.image) {
        const newUrl = await migrateImage(product.image, folder);
        if (newUrl && newUrl !== product.image) {
          updates.image = newUrl;
          productChanged = true;
          totalMigrated++;
        } else if (newUrl === product.image) {
          totalSkipped++;
        } else {
          totalFailed++;
        }
      }

      // Migrate additional images
      const newAdditionalImages: string[] = [];
      for (const img of product.additionalImages) {
        const newUrl = await migrateImage(img, folder);
        if (newUrl && newUrl !== img) {
          newAdditionalImages.push(newUrl);
          productChanged = true;
          totalMigrated++;
        } else if (newUrl === img) {
          newAdditionalImages.push(img);
          totalSkipped++;
        } else {
          newAdditionalImages.push(img);
          totalFailed++;
        }
      }

      if (productChanged && newAdditionalImages.length > 0) {
        updates.additionalImages = JSON.stringify(newAdditionalImages);
      }

      if (productChanged && !dryRun) {
        await db.update(productsTable).set(updates).where(eq(productsTable.id, product.id));
        console.log(`  ✓ Updated product ${product.id} in database`);
      } else if (productChanged && dryRun) {
        console.log(`  [DRY RUN] Would update product ${product.id} with:`, updates);
      } else {
        console.log(`  No changes needed`);
      }
      console.log('');
    }

    console.log('=== Migration Summary ===');
    console.log(`Total images migrated: ${totalMigrated}`);
    console.log(`Total images skipped (already Cloudinary/external): ${totalSkipped}`);
    console.log(`Total images failed: ${totalFailed}`);

    if (dryRun) {
      console.log('\nThis was a dry run. Run without --dry-run to apply changes.');
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});