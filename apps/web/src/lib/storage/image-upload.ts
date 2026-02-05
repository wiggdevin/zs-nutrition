import { isDevMode } from '@/lib/auth'
import { logger } from '@/lib/safe-logger'

/**
 * Uploads a base64-encoded food image to Vercel Blob Storage and returns the
 * resulting public URL. If the upload is not possible (missing token, dev mode,
 * invalid data URL, or upload failure), the original base64 data URL is returned
 * unchanged so callers always receive a usable image reference.
 *
 * @param base64Data - Data URL string (e.g., `data:image/png;base64,...`)
 * @param userId - User ID used to namespace blob storage paths
 *   (`food-scans/{userId}/{timestamp}.{format}`)
 * @returns The public blob URL if the upload succeeds, or the original base64
 *   data URL as a fallback
 *
 * @remarks
 * - In dev mode (`isDevMode === true`) the function skips the upload entirely
 *   and returns the base64 data URL unchanged, avoiding unnecessary network
 *   calls during local development.
 * - The `BLOB_READ_WRITE_TOKEN` environment variable must be set for uploads
 *   to be attempted. When the token is missing the base64 fallback is used.
 */
export async function uploadFoodImage(
  base64Data: string,
  userId: string
): Promise<string> {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN

  if (blobToken && !isDevMode) {
    try {
      const { put } = await import('@vercel/blob')

      // Extract mime type and raw data from data URL
      const match = base64Data.match(/^data:image\/(\w+);base64,(.+)$/)
      if (!match) {
        logger.error('[uploadFoodImage] Invalid data URL format, falling back to base64', new Error('Invalid data URL format'))
        return base64Data
      }

      const format = match[1]
      const rawBase64 = match[2]
      const buffer = Buffer.from(rawBase64, 'base64')
      const timestamp = Date.now()
      const pathname = `food-scans/${userId}/${timestamp}.${format}`

      const blob = await put(pathname, buffer, {
        access: 'public',
        contentType: `image/${format}`,
      })

      return blob.url
    } catch (error) {
      logger.error('[uploadFoodImage] Vercel Blob upload failed:', error)
      return base64Data
    }
  }

  return base64Data
}
