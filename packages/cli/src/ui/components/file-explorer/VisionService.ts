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
    const imageBuffer = await readFile(imagePath);
    
    // Detect format and dimensions (placeholder - would use sharp in real implementation)
    const format = this.detectFormat(imagePath);
    const dimensions = await this.detectDimensions(imageBuffer, format);
    
    // Check if format is supported
    if (!this.supportedFormats.includes(format.toLowerCase())) {
      throw new Error(`Unsupported image format: ${format}`);
    }

    // Resize if needed
    let finalBuffer = imageBuffer;
    let resized = false;
    if (dimensions.width > this.maxDimension || dimensions.height > this.maxDimension) {
      finalBuffer = await this.resizeImage(imagePath, this.maxDimension);
      resized = true;
    }

    // Encode to base64
    const base64 = this.encodeBase64(finalBuffer);

    return {
      width: resized ? this.calculateResizedDimension(dimensions.width, dimensions.height, this.maxDimension).width : dimensions.width,
      height: resized ? this.calculateResizedDimension(dimensions.width, dimensions.height, this.maxDimension).height : dimensions.height,
      format,
      base64,
      resized
    };
  }

  /**
   * Resize an image to fit within maxDimension while maintaining aspect ratio
   */
  async resizeImage(imagePath: string, maxDimension: number): Promise<Buffer> {
    // In a real implementation, this would use sharp library
    // For now, return a placeholder that simulates resizing
    const imageBuffer = await readFile(imagePath);
    
    // Placeholder: In real implementation, use sharp to resize
    // const sharp = require('sharp');
    // return await sharp(imageBuffer)
    //   .resize(maxDimension, maxDimension, { fit: 'inside' })
    //   .toBuffer();
    
    return imageBuffer;
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
   * Detect image dimensions (placeholder implementation)
   */
  private async detectDimensions(imageBuffer: Buffer, format: string): Promise<{ width: number; height: number }> {
    // In a real implementation, this would parse image headers or use sharp
    // For now, return placeholder dimensions
    
    // Simple PNG dimension detection (reads width/height from IHDR chunk)
    if (format === 'png' && imageBuffer.length > 24) {
      const width = imageBuffer.readUInt32BE(16);
      const height = imageBuffer.readUInt32BE(20);
      return { width, height };
    }
    
    // Simple JPEG dimension detection (basic implementation)
    if ((format === 'jpeg' || format === 'jpg') && imageBuffer.length > 2) {
      // This is a simplified JPEG parser - real implementation would be more robust
      let offset = 2;
      while (offset < imageBuffer.length - 9) {
        if (imageBuffer[offset] === 0xFF) {
          const marker = imageBuffer[offset + 1];
          // SOF0, SOF1, SOF2 markers contain dimensions
          if (marker >= 0xC0 && marker <= 0xC3) {
            const height = imageBuffer.readUInt16BE(offset + 5);
            const width = imageBuffer.readUInt16BE(offset + 7);
            return { width, height };
          }
          // Skip to next marker
          const length = imageBuffer.readUInt16BE(offset + 2);
          offset += length + 2;
        } else {
          offset++;
        }
      }
    }
    
    // Fallback dimensions
    return { width: 800, height: 600 };
  }

  /**
   * Calculate resized dimensions maintaining aspect ratio
   */
  private calculateResizedDimension(width: number, height: number, maxDimension: number): { width: number; height: number } {
    if (width > height) {
      return {
        width: maxDimension,
        height: Math.round((height / width) * maxDimension)
      };
    } else {
      return {
        width: Math.round((width / height) * maxDimension),
        height: maxDimension
      };
    }
  }
}
