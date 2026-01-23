import React, { useState, useEffect, useReducer, useMemo, memo, useRef } from 'react';
import { Box, Text, useStdout } from 'ink';
import { Jimp, ResizeStrategy } from 'jimp';
import path from 'path';
import { fileURLToPath } from 'url';

// --- CONFIGURATION ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Assets now live adjacent to the component inside the CLI package.
// packages/cli/src/components -> lama/lama_sprite
const ASSETS_PATH = path.resolve(__dirname, 'lama/lama_sprite');

type Direction = 'left' | 'right';
type Size = 'standard' | 'small' | 'xsmall' | 'large' | 'xlarge';

interface LlamaAnimationProps {
    size?: Size;
    paddingLeft?: number;
    movementRatio?: number; // Fraction of viewport width used for bouncing
    movementWidth?: number;
}

// Frame data structure - stores rows separately for positioning
interface FrameData {
    rows: string[];  // Individual rows (raw, without padding)
    spriteWidth: number; // Character width of sprite
}

// Helper: Integer to RGBA
function intToRGBA(i: number) {
    return {
        r: (i >>> 24) & 0xFF,
        g: (i >>> 16) & 0xFF,
        b: (i >>> 8) & 0xFF,
        a: i & 0xFF
    };
}

// --- IMAGE PROCESSING (Manual Nearest Neighbor + Half-Block) ---
// Returns frames with row arrays for positioning
async function loadLlamaFrames(size: Size): Promise<Record<Direction, FrameData[]>> {
    let logicalHeight = 20; // Default standard lines of text
    if (size === 'xsmall') logicalHeight = 7;   // 7 lines = 14px effective
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
            
            const origW = image.bitmap.width;  
            const origH = image.bitmap.height;
            
            // ADAPTIVE SCALING STRATEGY (Restored)
            // - Small/Standard: Use Manual NEAREST_NEIGHBOR (Crisp, vivid colors)
            // - Large/XL (Upscaling): Use Jimp BICUBIC Resize (Smooth/High Quality)
            // This prevents "washed out" colors on small sizes caused by bicubic interpolation
            
            const isUpscale = pixelHeight > origH || size === 'xsmall'; // Force Bicubic for xsmall test
            
            if (isUpscale) {
                // Resize the buffer explicitly for better interpolation (only for upscaling)
                image.resize({ w: pixelWidth, h: pixelHeight, mode: ResizeStrategy.BICUBIC });
            }

            const rows: string[] = [];

            for (let y = 0; y < logicalHeight; y++) {
                let row = '';
                for (let x = 0; x < pixelWidth; x++) {
                    let cTop, cBot;

                    if (isUpscale) {
                        // 1:1 Sampling from resized buffer (Smooth)
                        // Top pixel at (x, y*2)
                        // Bot pixel at (x, y*2+1)
                        cTop = intToRGBA(image.getPixelColor(x, y * 2));
                        cBot = intToRGBA(image.getPixelColor(x, y * 2 + 1));
                    } else {
                        // Sub-sampling from original buffer (Crisp Nearest Neighbor)
                        // This preserves exact original pixel colors
                        const srcX = Math.floor(x * (origW / pixelWidth));
                        const srcY_Top = Math.floor((y * 2) * (origH / pixelHeight));
                        const srcY_Bot = Math.floor((y * 2 + 1) * (origH / pixelHeight));

                        cTop = intToRGBA(image.getPixelColor(srcX, srcY_Top));
                        cBot = intToRGBA(image.getPixelColor(srcX, srcY_Bot));
                    }

                    // --- DENSE BLOCK LOGIC ---
                    const topVisible = cTop.a >= 128;
                    const botVisible = cBot.a >= 128;

                    if (topVisible && botVisible) {
                        // BOTH pixels have color
                        // Fore = Top, Back = Bottom, Char = Upper Block (▀)
                        row += `\x1b[38;2;${cTop.r};${cTop.g};${cTop.b}m\x1b[48;2;${cBot.r};${cBot.g};${cBot.b}m▀`;
                    } else if (topVisible && !botVisible) {
                        // TOP only
                        // Fore = Top, Back = Default/Transparent, Char = Upper Block (▀)
                        row += `\x1b[38;2;${cTop.r};${cTop.g};${cTop.b}m\x1b[49m▀`;
                    } else if (!topVisible && botVisible) {
                        // BOTTOM only
                        // Fore = Bottom, Back = Default/Transparent, Char = Lower Block (▄)
                        row += `\x1b[38;2;${cBot.r};${cBot.g};${cBot.b}m\x1b[49m▄`;
                    } else {
                        // NEITHER
                        // Reset all, Space
                        row += `\x1b[0m `;
                    }
                }
                // Reset style at end of row
                rows.push(row + '\x1b[0m');
            }
            
            return {
                rows,
                spriteWidth: pixelWidth
            };
            
        } catch (_e) {
            return { rows: [], spriteWidth: 0 }; 
        }
    };

    // Load sequences
    // We assume 6 frames per direction: llama-r1..6, llama-l1..6
    for (let i = 1; i <= 6; i++) {
        frames.right.push(await processContent(path.join(ASSETS_PATH, 'right', `llama-r${i}.png`)));
        frames.left.push(await processContent(path.join(ASSETS_PATH, 'left', `llama-l${i}.png`)));
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
    const paddedRows = rows.map(row => {
        // Each row: [leftPad][sprite content][reset][rightPad]
        return leftPadStr + row + '\x1b[0m' + rightPadStr;
    });
    
    // No cursor hiding - let terminal handle it naturally
    return paddedRows.join('\n');
}

export const LlamaAnimation: React.FC<LlamaAnimationProps> = memo(({ size = 'small', paddingLeft: initialPadding = 0, movementRatio = 1, movementWidth }) => {
    const [frames, setFrames] = useState<Record<Direction, FrameData[]> | null>(null);
    const [animationState, dispatch] = useReducer(
        (state: { frameIdx: number; step: number; direction: Direction; maxSteps: number }, action: { type: 'tick'; maxSteps: number; frameCount: number }) => {
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

    let logicalHeight = 20;
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
        loadLlamaFrames(size).then(setFrames);
    }, [size]);

    useEffect(() => {
        if (!frames || !isInteractive) return;

        // Use 120ms tick interval for smooth animation
        const timer = setInterval(() => {
            dispatch({ type: 'tick', maxSteps: computedMaxSteps, frameCount: frames.right.length });
        }, 120);

        return () => clearInterval(timer);
    }, [frames, isInteractive, computedMaxSteps]);

    // Get current frame data - use stable fallback to prevent flashing during direction changes
    const currentFrameData = useMemo(() => {
        if (!frames) return null;
        const frameSet = frames[direction];
        const frame = frameSet?.[frameIdx];
        // Fallback to first frame of current direction if frameIdx is out of range
        // This prevents blank frames during animation transitions
        if (!frame || frame.rows.length === 0) {
            return frameSet?.[0] ?? frames.right[0] ?? null;
        }
        return frame;
    }, [frames, direction, frameIdx]);

    // Keep track of last valid frame to prevent blank flashes
    const lastValidFrame = useRef<FrameData | null>(null);
    const frameToRender = currentFrameData && currentFrameData.rows.length > 0 
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
    if (!frames || !paddedFrame) return null;

    // Render as a single Text block - entire frame updates atomically
    // Fixed height and width container prevents layout shift
    return (
        <Box height={logicalHeight} width={dynamicWidth} overflow="hidden">
            <Text wrap="truncate">{paddedFrame}</Text>
        </Box>
    );
});
LlamaAnimation.displayName = 'LlamaAnimation';
