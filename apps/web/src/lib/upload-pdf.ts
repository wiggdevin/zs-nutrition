/**
 * Uploads a PDF buffer and returns a publicly-accessible URL.
 *
 * - Production: Uses Vercel Blob storage
 * - Dev mode: Saves to /public/generated-pdfs/ and returns a local URL
 */
import { isDevMode } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

export interface UploadResult {
  success: boolean
  url?: string
  error?: string
}

/**
 * Upload a PDF buffer and return the public URL.
 */
export async function uploadPlanPdf(
  pdfBuffer: Buffer,
  filename: string
): Promise<UploadResult> {
  try {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN

    // In production with Vercel Blob token, upload to Vercel Blob
    if (blobToken && !isDevMode) {
      try {
        const { put } = await import('@vercel/blob')
        const blob = await put(`meal-plans/${filename}`, pdfBuffer, {
          access: 'public',
          contentType: 'application/pdf',
        })
        return { success: true, url: blob.url }
      } catch (blobError) {
        console.error('[uploadPlanPdf] Vercel Blob upload failed:', blobError instanceof Error ? blobError.message : 'Unknown error')
        // Fall through to local storage
      }
    }

    // Dev mode or blob not configured: save locally to public folder
    const publicDir = path.join(process.cwd(), 'public', 'generated-pdfs')
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true })
    }

    const filePath = path.join(publicDir, filename)
    fs.writeFileSync(filePath, pdfBuffer)

    const webAppUrl = process.env.WEB_APP_URL || 'http://localhost:3456'
    const url = `${webAppUrl}/generated-pdfs/${filename}`

    console.log(`[uploadPlanPdf] PDF saved locally: ${filePath}`)
    console.log(`[uploadPlanPdf] Accessible at: ${url}`)

    return { success: true, url }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown upload error'
    console.error('[uploadPlanPdf] Error:', errorMsg)
    return { success: false, error: errorMsg }
  }
}
