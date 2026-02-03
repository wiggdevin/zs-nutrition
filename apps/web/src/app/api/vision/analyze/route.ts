import { NextResponse, NextRequest } from 'next/server'
import { getAuth } from '@clerk/nextjs/server'
import { getVisionClient, FoodAnalysisResult } from '@/lib/vision/claude-vision'
import { prisma } from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'

interface AnalyzeRequest {
  imageData: string // Base64 data URL
  scanType?: 'food_plate' | 'restaurant_menu'
}

/**
 * POST /api/vision/analyze
 *
 * Analyze a food photo using Claude Vision
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await getAuth(request)

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request
    const body: AnalyzeRequest = await request.json()
    const { imageData, scanType = 'food_plate' } = body

    if (!imageData) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      )
    }

    // Validate image data URL format
    if (!imageData.startsWith('data:image/')) {
      return NextResponse.json(
        { error: 'Invalid image format. Must be a data URL.' },
        { status: 400 }
      )
    }

    // Get vision client and check availability
    const visionClient = getVisionClient()

    if (!visionClient.isAvailable()) {
      return NextResponse.json(
        {
          error: 'Vision service not available',
          message: 'The ANTHROPIC_API_KEY is not configured. Please contact support.',
        },
        { status: 503 }
      )
    }

    // Create FoodScan record for tracking
    const scanId = uuidv4()

    await prisma.foodScan.create({
      data: {
        id: scanId,
        userId,
        scanType,
        photoUrl: imageData, // Store base64 data (will be moved to blob storage in production)
        status: 'processing',
      },
    })

    try {
      // Analyze the image
      const analysisResult: FoodAnalysisResult = await visionClient.analyzeFoodPhoto(imageData)

      // Update FoodScan with results
      await prisma.foodScan.update({
        where: { id: scanId },
        data: {
          status: 'completed',
          analysisResult: JSON.stringify(analysisResult),
          completedAt: new Date(),
        },
      })

      // Return the analysis
      return NextResponse.json({
        success: true,
        scanId,
        result: analysisResult,
      })
    } catch (analysisError) {
      // Update FoodScan with error
      const errorMessage = analysisError instanceof Error
        ? analysisError.message
        : 'Unknown error during analysis'

      await prisma.foodScan.update({
        where: { id: scanId },
        data: {
          status: 'failed',
          error: errorMessage,
        },
      })

      throw analysisError
    }
  } catch (error) {
    console.error('Error in /api/vision/analyze:', error)

    const message = error instanceof Error ? error.message : 'Failed to analyze image'

    return NextResponse.json(
      {
        error: 'Analysis failed',
        message,
      },
      { status: 500 }
    )
  }
}
