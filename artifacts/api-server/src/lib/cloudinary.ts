import { v2 as cloudinary } from 'cloudinary';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error(
    'Cloudinary configuration missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.',
  );
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

export interface CloudinaryDeleteResult {
  result: string;
}

export class CloudinaryError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'CloudinaryError';
  }
}

export async function uploadImage(
  buffer: Buffer,
  options: {
    folder?: string;
    publicId?: string;
    resourceType?: 'image' | 'video' | 'raw' | 'auto';
  } = {},
): Promise<CloudinaryUploadResult> {
  const { folder = 'crochet-boutique/products', publicId, resourceType = 'image' } = options;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: resourceType,
        overwrite: false,
        unique_filename: true,
        use_filename: false,
      },
      (error, result) => {
        if (error || !result) {
          reject(new CloudinaryError('Failed to upload image to Cloudinary', error));
          return;
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          format: result.format,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
        });
      },
    );
    uploadStream.end(buffer);
  });
}

export async function deleteImage(publicId: string): Promise<CloudinaryDeleteResult> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, { resource_type: 'image' }, (error, result) => {
      if (error) {
        reject(new CloudinaryError('Failed to delete image from Cloudinary', error));
        return;
      }
      resolve({ result: result?.result ?? 'not found' });
    });
  });
}

export function getOptimizedUrl(publicId: string, options: {
  width?: number;
  height?: number;
  crop?: 'fill' | 'scale' | 'fit' | 'thumb';
  quality?: 'auto' | number;
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
} = {}): string {
  const { width, height, crop = 'fill', quality = 'auto', format = 'auto' } = options;
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      { width, height, crop, quality, fetch_format: format },
    ],
  });
}

export function extractPublicIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const uploadIndex = pathParts.indexOf('upload');
    if (uploadIndex === -1 || uploadIndex + 1 >= pathParts.length) {
      return null;
    }
    const publicIdWithExtension = pathParts.slice(uploadIndex + 1).join('/');
    const publicId = publicIdWithExtension.replace(/\.[^.]+$/, '');
    return publicId;
  } catch {
    return null;
  }
}

export { cloudinary };