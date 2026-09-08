export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateImageFile(file: {
  name: string;
  size: number;
  contentType: string;
}): string | null {
  if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.contentType)) {
    return `Unsupported file type: ${file.contentType}. Allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}`;
  }
  if (file.size > MAX_IMAGE_FILE_SIZE) {
    return `File too large: ${file.size} bytes. Maximum: ${MAX_IMAGE_FILE_SIZE} bytes`;
  }
  return null;
}
