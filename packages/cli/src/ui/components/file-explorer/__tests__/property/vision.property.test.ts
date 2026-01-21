/**
 * Property-Based Tests for VisionService
 * 
 * These tests validate universal properties that should hold for all valid inputs
 * to the VisionService, including image processing, encoding, and format validation.
 * 
 * Feature: file-explorer-ui
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { VisionService } from '../../VisionService.js';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('VisionService - Property-Based Tests', () => {
  /**
   * Property 23: Image Encoding Produces Valid Base64
   * 
   * For any valid image buffer, encoding it should produce a valid base64 string
   * that can be decoded back to the original data.
   * 
   * Validates: Requirements 6.3
   */
  describe('Property 23: Image Encoding Produces Valid Base64', () => {
    it('should encode any buffer to valid base64 that can be decoded back', () => {
      fc.assert(
        fc.property(
          // Generate random byte arrays of various sizes
          fc.uint8Array({ minLength: 1, maxLength: 10000 }),
          (bytes) => {
            const visionService = new VisionService();
            const buffer = Buffer.from(bytes);
            
            // Encode to base64
            const base64String = visionService.encodeBase64(buffer);
            
            // Verify it's a valid base64 string (only contains valid base64 characters)
            const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
            expect(base64String).toMatch(base64Regex);
            
            // Verify it can be decoded back to the original data
            const decodedBuffer = Buffer.from(base64String, 'base64');
            expect(decodedBuffer).toEqual(buffer);
            
            // Verify the decoded data matches the original bytes
            expect(Array.from(decodedBuffer)).toEqual(Array.from(bytes));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce base64 strings with correct length properties', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 1000 }),
          (bytes) => {
            const visionService = new VisionService();
            const buffer = Buffer.from(bytes);
            
            const base64String = visionService.encodeBase64(buffer);
            
            // Base64 encoding increases size by ~33% (4 chars for every 3 bytes)
            // The length should be a multiple of 4 (with padding)
            expect(base64String.length % 4).toBe(0);
            
            // Verify the encoded length is approximately correct
            const expectedMinLength = Math.ceil((bytes.length * 4) / 3);
            const expectedMaxLength = expectedMinLength + 3; // Account for padding
            expect(base64String.length).toBeGreaterThanOrEqual(expectedMinLength);
            expect(base64String.length).toBeLessThanOrEqual(expectedMaxLength);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty buffers correctly', () => {
      const visionService = new VisionService();
      const emptyBuffer = Buffer.from([]);
      
      const base64String = visionService.encodeBase64(emptyBuffer);
      
      // Empty buffer should produce empty string
      expect(base64String).toBe('');
      
      // Should be decodable back to empty buffer
      const decoded = Buffer.from(base64String, 'base64');
      expect(decoded.length).toBe(0);
    });

    it('should produce consistent encoding for the same input', () => {
      fc.assert(
        fc.property(
          fc.uint8Array({ minLength: 1, maxLength: 1000 }),
          (bytes) => {
            const visionService = new VisionService();
            const buffer = Buffer.from(bytes);
            
            // Encode the same buffer multiple times
            const encoding1 = visionService.encodeBase64(buffer);
            const encoding2 = visionService.encodeBase64(buffer);
            const encoding3 = visionService.encodeBase64(buffer);
            
            // All encodings should be identical (deterministic)
            expect(encoding1).toBe(encoding2);
            expect(encoding2).toBe(encoding3);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle binary data with all possible byte values', () => {
      fc.assert(
        fc.property(
          // Generate arrays containing all possible byte values (0-255)
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 1, maxLength: 256 }),
          (byteValues) => {
            const visionService = new VisionService();
            const buffer = Buffer.from(byteValues);
            
            const base64String = visionService.encodeBase64(buffer);
            
            // Should be valid base64
            const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
            expect(base64String).toMatch(base64Regex);
            
            // Should decode back correctly
            const decoded = Buffer.from(base64String, 'base64');
            expect(Array.from(decoded)).toEqual(byteValues);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Integration test: Verify base64 encoding works with actual image processing
   */
  describe('Base64 Encoding Integration', () => {
    it('should encode processed images to valid base64', async () => {
      const visionService = new VisionService();
      const testDir = join(tmpdir(), `vision-test-${Date.now()}`);
      
      try {
        await mkdir(testDir, { recursive: true });
        
        // Create a minimal valid PNG image (1x1 pixel, red)
        const pngData = Buffer.from([
          0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
          0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
          0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // Width: 1, Height: 1
          0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // Bit depth, color type, etc.
          0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
          0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
          0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D,
          0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, // IEND chunk
          0x44, 0xAE, 0x42, 0x60, 0x82
        ]);
        
        const imagePath = join(testDir, 'test.png');
        await writeFile(imagePath, pngData);
        
        // Process the image
        const metadata = await visionService.processImage(imagePath);
        
        // Verify base64 is valid
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        expect(metadata.base64).toMatch(base64Regex);
        
        // Verify it can be decoded
        const decoded = Buffer.from(metadata.base64, 'base64');
        expect(decoded.length).toBeGreaterThan(0);
        
        // Verify the decoded data is valid (should be the original PNG data)
        expect(decoded).toEqual(pngData);
      } finally {
        // Cleanup
        await rm(testDir, { recursive: true, force: true });
      }
    });
  });
});
