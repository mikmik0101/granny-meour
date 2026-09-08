import { Router, type IRouter, type Request, type Response } from 'express';
import { clerkClient } from '@clerk/express';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import {
  validateImageFile,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_FILE_SIZE,
} from '../../../shared/image-validation.js';

import { deleteImage, BlobStorageError } from '../lib/blob-storage.js';

function parseAdminEmails(): string[] {
  const emails = process.env.CROCHET_ADMIN_EMAILS?.trim() || process.env.CROCHET_ADMIN_EMAIL?.trim() || "";
  return emails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

async function isAdmin(req: Request): Promise<boolean> {
  const authReq = req as Request & { auth?: () => { userId?: string | null } };
  const userId = typeof authReq.auth === 'function' ? authReq.auth().userId : null;
  const allowedEmails = parseAdminEmails();
  const user = userId && allowedEmails.length > 0 ? await clerkClient.users.getUser(userId) : null;
  const primaryEmail = user?.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  )?.emailAddress.trim().toLowerCase();
  return Boolean(userId && allowedEmails.length > 0 && primaryEmail && allowedEmails.includes(primaryEmail));
}

const router: IRouter = Router();

const BLOB_PATH_PREFIX = 'crochet-boutique/products/';

// Client-upload token endpoint. The browser asks this route for a scoped,
// short-lived client token; the raw image bytes never pass through this
// function (they go browser -> Vercel Blob directly), so Vercel's ~4.5 MB
// request-body limit for functions never applies. The token itself encodes
// the MIME allowlist, 10 MB size cap, random-suffix naming, and expiry, and
// is enforced by Vercel Blob at upload time — a token minted here cannot be
// used to upload other content types or sizes, and anonymous visitors get
// no token at all (403 before generation).
router.post('/storage/upload', async (req: Request, res: Response) => {
  if (!(await isAdmin(req))) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  try {
    const body = req.body as HandleUploadBody;

    if (body.type === 'blob.generate-client-token') {
      const { pathname } = body.payload;

      // Server-side validation mirrors the client: only product-image
      // pathnames, MIME types, and sizes are ever tokenized.
      if (typeof pathname !== 'string' || !pathname.startsWith(BLOB_PATH_PREFIX)) {
        res.status(400).json({ error: 'Invalid upload path' });
        return;
      }
      const fileName = pathname.slice(BLOB_PATH_PREFIX.length);
      if (!fileName || fileName.includes('/') || fileName.includes('..')) {
        res.status(400).json({ error: 'Invalid upload path' });
        return;
      }
      const contentType = req.body?.contentType as string | undefined;

      const result = await handleUpload({
        request: req,
        body,
        onBeforeGenerateToken: async (path, _clientPayload, _multipart) => {
          if (contentType) {
            const validationError = validateImageFile({
              name: fileName,
              size: 0, // size is enforced by the token's maximumSizeInBytes below
              contentType,
            });
            if (validationError) {
              throw new Error(validationError);
            }
          }
          return {
            allowedContentTypes: [...ALLOWED_IMAGE_MIME_TYPES],
            maximumSizeInBytes: MAX_IMAGE_FILE_SIZE,
            addRandomSuffix: true,
            allowOverwrite: false,
          };
        },
      });

      if (result.type === 'blob.generate-client-token') {
        res.json({ clientToken: result.clientToken });
        return;
      }
      // upload-completed callbacks only occur when onUploadCompleted is set,
      // which this deployment does not use.
      res.status(400).json({ error: 'Unsupported upload event' });
      return;
    }

    res.status(400).json({ error: 'Unsupported upload event' });
  } catch (error) {
    req.log.error({ err: error }, 'Blob client token error');
    res.status(500).json({ error: 'Failed to generate upload token' });
  }
});

// Legacy direct-upload endpoint (pre-migration). Retained as an authenticated
// 410 so stale admin clients fail loudly with a clear message instead of
// silently uploading through the old path.
router.all('/storage/uploads/request-url', async (req: Request, res: Response) => {
  if (!(await isAdmin(req))) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  res.status(410).json({ error: 'This upload flow has been replaced. Refresh the page and use the new uploader.' });
});

router.delete(
  '/storage/image/:publicId',
  async (req: Request, res: Response) => {
    if (!(await isAdmin(req))) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    try {
      const rawPublicId = req.params.publicId;
      const publicId = Array.isArray(rawPublicId) ? rawPublicId[0] : rawPublicId;
      if (!publicId) {
        res.status(400).json({ error: 'Invalid public ID' });
        return;
      }

      await deleteImage(publicId);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof BlobStorageError) {
        req.log.error({ err: error }, 'Blob delete error');
        res.status(500).json({ error: 'Failed to delete image' });
        return;
      }
      req.log.error({ err: error }, 'Error deleting image');
      res.status(500).json({ error: 'Failed to delete image' });
    }
  },
);

export default router;
