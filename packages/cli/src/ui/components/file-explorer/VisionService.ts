/**
 * VisionService - Image processing and encoding for vision models
 *
 * Responsibilities:
 * - Detect image dimensions
 * - Resize images exceeding 2048px
 * - Encode images as base64
 * - Validate image formats
 */

import { readFile } from 'fs/promises';

import sharp from 'sharp';

import { ImageMetadata } from './types.js';

export class VisionService {
  private readonly supportedFormats = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
  private readonly maxDimension = 2048;

  /**
   * Get list of supported image formats
   */
  getSupportedFormats(): string[] {
    return [...this.supportedFormats];
  }

  /**
   * Process an image file - detect dimensions, resize if needed, and encode
   */
  async processImage(imagePath: string): Promise<ImageMetadata> {
    // Read the image file
    const imageBuffer: Buffer = await readFile(imagePath);

    // Detect format and dimensions using sharp
    const metadata = await sharp(imageBuffer).metadata();
    const format = metadata.format || this.detectFormat(imagePath);
    const dimensions = {
      width: metadata.width || 800,
      height: metadata.height || 600,
    };

    // Check if format is supported
    if (!this.supportedFormats.includes(format.toLowerCase())) {
      throw new Error(`Unsupported image format: ${format}`);
    }

    // Resize if needed
    let finalBuffer: Buffer = imageBuffer;
    let resized = false;
    if (dimensions.width > this.maxDimension || dimensions.height > this.maxDimension) {
      finalBuffer = await this.resizeImage(imagePath, this.maxDimension);
      resized = true;
    }

    // Encode to base64
    const base64 = this.encodeBase64(finalBuffer);

    return {
      width: resized
        ? this.calculateResizedDimension(dimensions.width, dimensions.height, this.maxDimension)
            .width
        : dimensions.width,
      height: resized
        ? this.calculateResizedDimension(dimensions.width, dimensions.height, this.maxDimension)
            .height
        : dimensions.height,
      format,
      base64,
      resized,
    };
  }

  /**
   * Resize an image to fit within maxDimension while maintaining aspect ratio
   */
  async resizeImage(imagePath: string, maxDimension: number): Promise<Buffer> {
    return await sharp(imagePath)
      .resize(maxDimension, maxDimension, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer();
  }

  /**
   * Encode image buffer as base64 string
   */
  encodeBase64(imageBuffer: Buffer): string {
    return imageBuffer.toString('base64');
  }

  /**
   * Detect image format from file path
   */
  private detectFormat(imagePath: string): string {
    const ext = imagePath.split('.').pop()?.toLowerCase() || '';
    return ext === 'jpg' ? 'jpeg' : ext;
  }

  /**
   * Calculate resized dimensions maintaining aspect ratio
   */
  private calculateResizedDimension(
    width: number,
    height: number,
    maxDimension: number
  ): { width: number; height: number } {
    if (width > height) {
      return {
        width: maxDimension,
        height: Math.round((height / width) * maxDimension),
      };
    } else {
      return {
        width: Math.round((width / height) * maxDimension),
        height: maxDimension,
      };
    }
  }
}
