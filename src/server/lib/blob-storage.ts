import { del } from '@vercel/blob';

const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

if (!blobToken) {
  throw new Error(
    'Vercel Blob configuration missing. Set BLOB_READ_WRITE_TOKEN environment variable.',
  );
}

export class BlobStorageError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'BlobStorageError';
  }
}

const MAX_FAILURE_DETAIL_LENGTH = 300;

// Extract safe, non-secret diagnostic fields from a @vercel/blob SDK
// rejection. Reads message/name/statusCode scalars only — never the token,
// headers, bodies, or URLs that may embed credentials.
function describeStorageFailure(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, MAX_FAILURE_DETAIL_LENGTH);
  }
  const record =
    typeof error === 'object' && error !== null
      ? (error as Record<string, unknown>)
      : {};
  const message =
    typeof record.message === 'string' && record.message.length > 0
      ? record.message.slice(0, MAX_FAILURE_DETAIL_LENGTH)
      : 'unknown error';
  const status =
    typeof record.statusCode === 'number' ? ` (status: ${record.statusCode})` : '';
  return `${message}${status}`;
}

// Delete by blob URL or store pathname. @vercel/blob del() accepts both;
// blobs outside this store's token scope are rejected by the Blob API.
export async function deleteImage(
  target: string,
): Promise<{ result: string }> {
  try {
    await del(target, { token: blobToken });
    return { result: 'deleted' };
  } catch (error) {
    throw new BlobStorageError(
      `Failed to delete image from Vercel Blob: ${describeStorageFailure(error)}`,
      error,
    );
  }
}
