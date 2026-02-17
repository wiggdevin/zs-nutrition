import { gzipSync, gunzipSync } from 'zlib';

/** JSON-compatible value type (matches Prisma's InputJsonValue) */
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type CompressedJson =
  | { compressed: true; data: string }
  | { compressed: false; data: JsonValue };

/**
 * Compress a JSON-serializable value to a base64-encoded gzip string.
 * Returns the original value if compression doesn't save space or if the
 * input is small enough (<10KB) that compression overhead isn't worth it.
 */
export function compressJson(data: unknown): CompressedJson {
  const json = JSON.stringify(data);
  // Don't bother compressing small payloads
  if (json.length < 10_000) {
    return { compressed: false, data: data as JsonValue };
  }
  const gzipped = gzipSync(Buffer.from(json, 'utf-8'));
  const base64 = gzipped.toString('base64');
  // Only use compression if it actually saves space
  if (base64.length < json.length * 0.9) {
    return { compressed: true, data: base64 };
  }
  return { compressed: false, data: data as JsonValue };
}

/**
 * Decompress a value that may or may not be compressed.
 * Handles both compressed ({compressed: true, data: string}) and
 * uncompressed values transparently for backward compatibility.
 */
export function decompressJson<T = unknown>(stored: unknown): T {
  if (stored && typeof stored === 'object' && 'compressed' in stored) {
    const wrapper = stored as { compressed: boolean; data: string | unknown };
    if (wrapper.compressed && typeof wrapper.data === 'string') {
      const buffer = gunzipSync(Buffer.from(wrapper.data, 'base64'));
      return JSON.parse(buffer.toString('utf-8')) as T;
    }
    return wrapper.data as T;
  }
  // Uncompressed (backward compatible with existing data)
  return stored as T;
}

/**
 * Get approximate size of a JSON value in bytes
 */
export function jsonSizeBytes(data: unknown): number {
  return Buffer.byteLength(JSON.stringify(data), 'utf-8');
}
