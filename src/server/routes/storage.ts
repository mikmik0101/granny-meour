import { Router, type IRouter, type Request, type Response } from 'express';
import { clerkClient } from '@clerk/express';
import { RequestUploadUrlBody, RequestUploadUrlResponse } from '../../../shared/zod/index.js';

import { uploadImage, deleteImage, CloudinaryError } from '../lib/cloudinary.js';

function parseAdminEmails(): string[] {
  const emails = process.env.CROCHET_ADMIN_EMAILS?.trim() || process.env.CROCHET_ADMIN_EMAIL?.trim() || "";
  return emails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

const router: IRouter = Router();

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function validateImageFile(file: { name: string; size: number; contentType: string }): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.contentType)) {
    return `Unsupported file type: ${file.contentType}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File too large: ${file.size} bytes. Maximum: ${MAX_FILE_SIZE} bytes`;
  }
  return null;
}

router.post(
  '/storage/uploads/request-url',
  async (req: Request, res: Response) => {
    const authReq = req as Request & { auth?: () => { userId?: string | null } };
    const userId = typeof authReq.auth === 'function' ? authReq.auth().userId : null;
    const allowedEmails = parseAdminEmails();
    const user = userId && allowedEmails.length > 0 ? await clerkClient.users.getUser(userId) : null;
    const primaryEmail = user?.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId,
    )?.emailAddress.trim().toLowerCase();
    if (!userId || allowedEmails.length === 0 || !primaryEmail || !allowedEmails.includes(primaryEmail)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Missing or invalid required fields' });
      return;
    }

    const validationError = validateImageFile(parsed.data);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    try {
      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL: '/api/storage/upload',
          objectPath: `/objects/${Date.now()}-${parsed.data.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`,
          metadata: { name: parsed.data.name, size: parsed.data.size, contentType: parsed.data.contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, 'Error generating upload response');
      res.status(500).json({ error: 'Failed to generate upload response' });
    }
  },
);

router.post(
  '/storage/upload',
  async (req: Request, res: Response) => {
    const authReq = req as Request & { auth?: () => { userId?: string | null } };
    const userId = typeof authReq.auth === 'function' ? authReq.auth().userId : null;
    const allowedEmails = parseAdminEmails();
    const user = userId && allowedEmails.length > 0 ? await clerkClient.users.getUser(userId) : null;
    const primaryEmail = user?.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId,
    )?.emailAddress.trim().toLowerCase();
    if (!userId || allowedEmails.length === 0 || !primaryEmail || !allowedEmails.includes(primaryEmail)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    try {
      const contentType = req.headers['content-type'];
      if (!contentType || !ALLOWED_MIME_TYPES.includes(contentType)) {
        res.status(400).json({ error: 'Invalid or missing Content-Type header' });
        return;
      }

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      if (buffer.length > MAX_FILE_SIZE) {
        res.status(400).json({ error: 'File too large' });
        return;
      }

      const result = await uploadImage(buffer, {
        folder: 'crochet-boutique/products',
      });

      res.json({
        url: result.secure_url,
        publicId: result.public_id,
      });
    } catch (error) {
      if (error instanceof CloudinaryError) {
        req.log.error({ err: error }, 'Cloudinary upload error');
        res.status(500).json({ error: 'Failed to upload image' });
        return;
      }
      req.log.error({ err: error }, 'Error uploading image');
      res.status(500).json({ error: 'Failed to upload image' });
    }
  },
);

router.delete(
  '/storage/image/:publicId',
  async (req: Request, res: Response) => {
    const authReq = req as Request & { auth?: () => { userId?: string | null } };
    const userId = typeof authReq.auth === 'function' ? authReq.auth().userId : null;
    const allowedEmails = parseAdminEmails();
    const user = userId && allowedEmails.length > 0 ? await clerkClient.users.getUser(userId) : null;
    const primaryEmail = user?.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId,
    )?.emailAddress.trim().toLowerCase();
    if (!userId || allowedEmails.length === 0 || !primaryEmail || !allowedEmails.includes(primaryEmail)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    try {
      const rawPublicId = req.params.publicId;
      const publicId = Array.isArray(rawPublicId) ? rawPublicId[0] : rawPublicId;
      if (!publicId || publicId.includes('..') || publicId.includes('/')) {
        res.status(400).json({ error: 'Invalid public ID' });
        return;
      }

      await deleteImage(publicId);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof CloudinaryError) {
        req.log.error({ err: error }, 'Cloudinary delete error');
        res.status(500).json({ error: 'Failed to delete image' });
        return;
      }
      req.log.error({ err: error }, 'Error deleting image');
      res.status(500).json({ error: 'Failed to delete image' });
    }
  },
);

export default router;