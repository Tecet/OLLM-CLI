import path from 'path';
import { fileURLToPath } from 'url';

import React, { useState, useEffect, useReducer, useMemo, memo, useRef } from 'react';
import { Box, Text, useStdout } from 'ink';
import { Jimp, ResizeStrategy } from 'jimp';

// --- CONFIGURATION ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In the bundled dist, lama_sprite is at dist/lama_sprite
// The bundled cli.js is at dist/cli.js, so we go up one level
const ASSETS_PATH = path.resolve(__dirname, 'lama_sprite');

type Direction = 'left' | 'right';
type Size = 'standard' | 'small' | 'xsmall' | 'large' | 'xlarge';

interface LlamaAnimationProps {
  size?: Size;
  paddingLeft?: number;
  movementRatio?: number; // Fraction of viewport width used for bouncing
  movementWidth?: number;
  enabled?: boolean; // Controls whether animation runs (default: false)
}

// Frame data structure - stores rows separately for positioning
interface FrameData {
  rows: string[]; // Individual rows (raw, without padding)
  spriteWidth: number; // Character width of sprite
}

// Helper: Integer to RGBA
function intToRGBA(i: number) {
  return {
    r: (i >>> 24) & 0xff,
    g: (i >>> 16) & 0xff,
    b: (i >>> 8) & 0xff,
    a: i & 0xff,
  };
}

// Helper: Quantize color to reduce flickering from subtle color variations
// Rounds to nearest multiple of 8 to stabilize colors between frames
function quantizeColor(c: { r: number; g: number; b: number; a: number }) {
  const q = 8; // Quantization step - higher = more stable but less color detail
  return {
    r: Math.round(c.r / q) * q,
    g: Math.round(c.g / q) * q,
    b: Math.round(c.b / q) * q,
    a: c.a,
  };
}

// --- IMAGE PROCESSING (Manual Nearest Neighbor + Half-Block) ---
// Returns frames with row arrays for positioning
async function loadLlamaFrames(size: Size): Promise<Record<Direction, FrameData[]>> {
  let logicalHeight = 24; // Default standard lines of text
  if (size === 'xsmall') logicalHeight = 7; // 7 lines = 14px effective
  if (size === 'small') logicalHeight = 12;
  if (size === 'large') logicalHeight = 48;
  if (size === 'xlarge') logicalHeight = 96;

  // We render 2 pixels per line (Top/Bottom half-blocks)
  const pixelHeight = logicalHeight * 2;
  const pixelWidth = pixelHeight; // Square aspect ratio 1:1
  const frames: Record<Direction, FrameData[]> = { right: [], left: [] };

  // Sub-function to process a single image file
  const processContent = async (p: string): Promise<FrameData> => {
    try {
      const image = await Jimp.read(p);

      // Ensure all sprites render to the same size regardless of source dimensions
      // This handles any dimension mismatches between sprite files
      // Always resize to target dimensions for consistent output
      image.resize({ w: pixelWidth, h: pixelHeight, mode: ResizeStrategy.NEAREST_NEIGHBOR });

      const rows: string[] = [];

      for (let y = 0; y < logicalHeight; y++) {
        let row = '';

        for (let x = 0; x < pixelWidth; x++) {
          // Always read from resized buffer - all sprites normalized to same size
          const cTopRaw = intToRGBA(image.getPixelColor(x, y * 2));
          const cBotRaw = intToRGBA(image.getPixelColor(x, y * 2 + 1));

          // Quantize colors to reduce flickering from subtle variations
          const cTop = quantizeColor(cTopRaw);
          const cBot = quantizeColor(cBotRaw);

          // --- DENSE BLOCK LOGIC ---
          // Use alpha threshold of 1 - any non-transparent pixel is visible
          const topVisible = cTopRaw.a >= 1;
          const botVisible = cBotRaw.a >= 1;

          // Always reset state at start of each character for consistency
          // This eliminates flickering caused by inconsistent escape sequences between frames
          if (topVisible && botVisible) {
            // BOTH pixels have color - foreground=top, background=bottom
            row += `\x1b[0m\x1b[38;2;${cTop.r};${cTop.g};${cTop.b}m\x1b[48;2;${cBot.r};${cBot.g};${cBot.b}m▀`;
          } else if (topVisible && !botVisible) {
            // TOP only - foreground=top, no background
            row += `\x1b[0m\x1b[38;2;${cTop.r};${cTop.g};${cTop.b}m▀`;
          } else if (!topVisible && botVisible) {
            // BOTTOM only - foreground=bottom, no background
            row += `\x1b[0m\x1b[38;2;${cBot.r};${cBot.g};${cBot.b}m▄`;
          } else {
            // NEITHER - transparent space
            row += `\x1b[0m `;
          }
        }
        // Row already ends in reset state from last character
        rows.push(row);
      }

      return {
        rows,
        spriteWidth: pixelWidth,
      };
    } catch (_e) {
      return { rows: [], spriteWidth: 0 };
    }
  };

  // Load sequences
  // We assume 6 frames per direction: llama-r1..6, llama-l1..6
  // Triple each frame for smoother animation
  for (let i = 1; i <= 6; i++) {
    const rightFrame = await processContent(path.join(ASSETS_PATH, 'right', `llama-r${i}.png`));
    const leftFrame = await processContent(path.join(ASSETS_PATH, 'left', `llama-l${i}.png`));
    // Push three times for smoother animation
    frames.right.push(rightFrame);
    frames.right.push(rightFrame);
    frames.right.push(rightFrame);
    frames.left.push(leftFrame);
    frames.left.push(leftFrame);
    frames.left.push(leftFrame);
  }
  return frames;
}

// --- COMPONENT ---
// Build a complete frame string with embedded padding for atomic rendering
// This avoids React layout recalculations entirely
function buildPaddedFrame(frameData: FrameData, leftPad: number, totalWidth: number): string {
  const { rows, spriteWidth } = frameData;
  const leftPadStr = ' '.repeat(Math.max(0, leftPad));
  const rightPad = Math.max(0, totalWidth - leftPad - spriteWidth);
  const rightPadStr = ' '.repeat(rightPad);

  // Build each row with padding baked in, ensuring exact width
  const paddedRows = rows.map((row) => {
    // Each row: [leftPad][sprite content][reset][rightPad]
    return leftPadStr + row + '\x1b[0m' + rightPadStr;
  });

  // No cursor hiding - let terminal handle it naturally
  return paddedRows.join('\n');
}

// Direct stdout animation component - bypasses Ink's render cycle
// Uses cursor positioning to update only the animation area
export const LlamaAnimationDirect: React.FC<LlamaAnimationProps & { startRow?: number }> = memo(
  ({
    size = 'small',
    paddingLeft: initialPadding = 0,
    movementRatio = 1,
    movementWidth,
    startRow,
  }) => {
    const [frames, setFrames] = useState<Record<Direction, FrameData[]> | null>(null);
    const animationRef = useRef<{
      frameIdx: number;
      step: number;
      direction: Direction;
      timer: NodeJS.Timeout | null;
    }>({ frameIdx: 0, step: 0, direction: 'right', timer: null });

    const { stdout } = useStdout();
    const isInteractive = stdout?.isTTY !== false;

    let logicalHeight = 24;
    if (size === 'xsmall') logicalHeight = 7;
    if (size === 'small') logicalHeight = 12;
    if (size === 'large') logicalHeight = 48;
    if (size === 'xlarge') logicalHeight = 96;

    const spriteWidth = logicalHeight * 2;
    const clampedRatio = Math.min(Math.max(movementRatio, 0.1), 1);
    const termWidth = stdout?.columns || 80;
    const termHeight = stdout?.rows || 24;
    const hasFixedMovementWidth = typeof movementWidth === 'number';
    const dynamicWidth = hasFixedMovementWidth
      ? Math.max(0, Math.floor(movementWidth ?? 0))
      : Math.max(0, Math.floor(termWidth * clampedRatio));
    const paddedInitial = Math.floor(initialPadding);
    const computedMaxSteps = Math.max(0, dynamicWidth - spriteWidth - paddedInitial);

    // Calculate starting row for cursor positioning
    const animStartRow = startRow ?? Math.max(1, termHeight - logicalHeight);

    useEffect(() => {
      loadLlamaFrames(size).then(setFrames);
    }, [size]);

    // Direct animation loop - writes to stdout bypassing Ink
    useEffect(() => {
      if (!frames || !isInteractive || !stdout) return;

      // Keep track of last valid frame to prevent flashing
      let lastValidOutput = '';

      const animationState = animationRef.current;
      const animate = () => {
        const state = animationState;
        const frameSet = frames[state.direction];

        // Ensure frameIdx is valid for current direction
        const frameCount = frameSet?.length || 6;
        const safeFrameIdx = state.frameIdx % frameCount;
        const frame = frameSet?.[safeFrameIdx];

        // Skip this tick if frame is invalid, but don't clear the screen
        if (!frame || frame.rows.length === 0) {
          if (lastValidOutput) {
            stdout.write(lastValidOutput);
          }
          return;
        }

        // Calculate position
        const maxLeftSpacing = Math.max(0, dynamicWidth - spriteWidth);
        const leftSpacing = Math.min(paddedInitial + state.step, maxLeftSpacing);
        const leftPadStr = ' '.repeat(Math.max(0, leftSpacing));
        // Right padding to ensure consistent line width and clear old content
        const rightPad = Math.max(0, dynamicWidth - leftSpacing - spriteWidth);
        const rightPadStr = ' '.repeat(rightPad);

        // Build the entire frame as a single string for atomic output
        // Hide cursor at start, show at end
        let output = '\x1b[?25l';

        // Draw each row at correct position - overwrite instead of clear for less flicker
        frame.rows.forEach((row, i) => {
          // Move cursor to row position, column 1, then draw full-width content
          output += `\x1b[${animStartRow + i};1H${leftPadStr}${row}\x1b[0m${rightPadStr}`;
        });

        // Show cursor again
        output += '\x1b[?25h';

        // Store for fallback
        lastValidOutput = output;

        // Use cork/uncork for truly atomic write if available
        if (typeof stdout.cork === 'function') {
          stdout.cork();
          stdout.write(output);
          stdout.uncork();
        } else {
          stdout.write(output);
        }

        // Update animation state AFTER rendering
        const isMovingRight = state.direction === 'right';
        let nextStep = state.step + (isMovingRight ? 1 : -1);
        let nextDirection = state.direction;

        if (nextStep > computedMaxSteps) {
          nextStep = computedMaxSteps;
          nextDirection = 'left';
        } else if (nextStep < 0) {
          nextStep = 0;
          nextDirection = 'right';
        }

        // Update frame index, wrapping for the NEXT direction's frame count
        const nextFrameSet = frames[nextDirection];
        const nextFrameCount = nextFrameSet?.length || 6;
        state.frameIdx = (safeFrameIdx + 1) % nextFrameCount;
        state.step = nextStep;
        state.direction = nextDirection;
      };

      // Initial draw
      animate();

      // Animation timer - 50ms for smooth animation
      animationState.timer = setInterval(animate, 50);

      return () => {
        if (animationState.timer) {
          clearInterval(animationState.timer);
          animationState.timer = null;
        }
      };
    }, [
      frames,
      isInteractive,
      stdout,
      computedMaxSteps,
      paddedInitial,
      dynamicWidth,
      spriteWidth,
      animStartRow,
    ]);

    // Return placeholder box to reserve space in Ink layout
    return <Box height={logicalHeight} width={dynamicWidth} />;
  }
);
LlamaAnimationDirect.displayName = 'LlamaAnimationDirect';

export const LlamaAnimation: React.FC<LlamaAnimationProps> = memo(
  ({
    size = 'small',
    paddingLeft: initialPadding = 0,
    movementRatio = 1,
    movementWidth,
    enabled = false,
  }) => {
    const [frames, setFrames] = useState<Record<Direction, FrameData[]> | null>(null);
    const [animationState, dispatch] = useReducer(
      (
        state: { frameIdx: number; step: number; direction: Direction; maxSteps: number },
        action: { type: 'tick'; maxSteps: number; frameCount: number }
      ) => {
        const { frameIdx, step, direction } = state;

        if (action.maxSteps <= 0) {
          return {
            frameIdx: (frameIdx + 1) % action.frameCount,
            step: 0,
            direction: 'right' as Direction,
            maxSteps: 0,
          };
        }

        const isMovingRight = direction === 'right';
        let nextStep = step + (isMovingRight ? 1 : -1);
        let nextDirection = direction;

        if (nextStep > action.maxSteps) {
          nextStep = action.maxSteps;
          nextDirection = 'left';
        } else if (nextStep < 0) {
          nextStep = 0;
          nextDirection = 'right';
        }

        return {
          frameIdx: (frameIdx + 1) % action.frameCount,
          step: nextStep,
          direction: nextDirection,
          maxSteps: action.maxSteps,
        };
      },
      {
        frameIdx: 0,
        step: 0,
        direction: 'right',
        maxSteps: 0,
      }
    );
    const { frameIdx, step, direction } = animationState;
    const { stdout } = useStdout();
    const isInteractive = stdout?.isTTY !== false;
    const shouldAnimate = enabled && isInteractive;

    let logicalHeight = 24;
    if (size === 'xsmall') logicalHeight = 7;
    if (size === 'small') logicalHeight = 12;
    if (size === 'large') logicalHeight = 48;
    if (size === 'xlarge') logicalHeight = 96;

    const spriteWidth = logicalHeight * 2;
    const clampedRatio = Math.min(Math.max(movementRatio, 0.1), 1);
    const termWidth = stdout?.columns || 80;
    const hasFixedMovementWidth = typeof movementWidth === 'number';
    const dynamicWidth = hasFixedMovementWidth
      ? Math.max(0, Math.floor(movementWidth ?? 0))
      : Math.max(0, Math.floor(termWidth * clampedRatio));
    const paddedInitial = Math.floor(initialPadding);
    const computedMaxSteps = Math.max(0, dynamicWidth - spriteWidth - paddedInitial);

    useEffect(() => {
      if (!enabled) {
        setFrames(null);
        return;
      }
      loadLlamaFrames(size).then(setFrames);
    }, [size, enabled]);

    useEffect(() => {
      if (!frames || !shouldAnimate) return;

      // Use 30ms tick interval to match 30 FPS
      const timer = setInterval(() => {
        dispatch({ type: 'tick', maxSteps: computedMaxSteps, frameCount: frames.right.length });
      }, 30);

      return () => clearInterval(timer);
    }, [frames, shouldAnimate, computedMaxSteps]);

    // Get current frame data - use stable fallback to prevent flashing during direction changes
    const currentFrameData = useMemo(() => {
      if (!frames) return null;
      const frameSet = frames[direction];
      // Ensure valid frameIdx
      const safeIdx = Math.abs(frameIdx) % (frameSet?.length || 6);
      const frame = frameSet?.[safeIdx];
      // Fallback to first frame of current direction if frameIdx is out of range
      // This prevents blank frames during animation transitions
      if (!frame || frame.rows.length === 0) {
        return frameSet?.[0] ?? frames.right[0] ?? null;
      }
      return frame;
    }, [frames, direction, frameIdx]);

    // Keep track of last valid frame to prevent blank flashes
    const lastValidFrame = useRef<FrameData | null>(null);
    const frameToRender =
      currentFrameData && currentFrameData.rows.length > 0
        ? currentFrameData
        : lastValidFrame.current;

    // Update the last valid frame reference
    if (currentFrameData && currentFrameData.rows.length > 0) {
      lastValidFrame.current = currentFrameData;
    }

    // Clamp leftSpacing to ensure sprite stays within bounds
    // Max left position is (dynamicWidth - spriteWidth) to prevent overflow
    const maxLeftSpacing = Math.max(0, dynamicWidth - spriteWidth);
    const leftSpacing = Math.min(paddedInitial + step, maxLeftSpacing);

    // Build the complete frame with padding baked in - this makes the update atomic
    // and avoids React layout recalculations that cause flicker
    // IMPORTANT: This useMemo must be called before any early returns to maintain hook order
    const paddedFrame = useMemo(() => {
      if (!frameToRender || frameToRender.rows.length === 0) return '';
      return buildPaddedFrame(frameToRender, leftSpacing, dynamicWidth);
    }, [frameToRender, leftSpacing, dynamicWidth]);

    // Don't render if no valid frame data at all
    if (!enabled || !frames || !paddedFrame) return null;

    // Render as a single Text block - entire frame updates atomically
    // Fixed height and width container prevents layout shift
    // Using key based on frame content hash to help React/Ink minimize rerenders
    return (
      <Box
        height={logicalHeight}
        width={dynamicWidth}
        overflow="hidden"
        flexShrink={0}
        flexGrow={0}
      >
        <Text wrap="truncate-end">{paddedFrame}</Text>
      </Box>
    );
  }
);
LlamaAnimation.displayName = 'LlamaAnimation';
