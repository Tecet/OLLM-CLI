
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { Jimp, ResizeStrategy } from 'jimp';
import path from 'path';
import { fileURLToPath } from 'url';

// --- CONFIGURATION ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// TODO: Move assets to a dedicated 'assets' folder in the package distribution
// Currently pointing to the docs folder relative to this component:
// packages/cli/src/components -> ../../../../docs/lama_sprite
const ASSETS_PATH = path.resolve(__dirname, '../../../../docs/lama_sprite');

type Direction = 'left' | 'right';
type Size = 'standard' | 'small' | 'xsmall' | 'large' | 'xlarge';

interface LlamaAnimationProps {
    size?: Size;
    paddingLeft?: number;
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
async function loadLlamaFrames(size: Size) {
    let logicalHeight = 24; // Default standard lines of text
    if (size === 'xsmall') logicalHeight = 7;   // 7 lines = 14px effective
    if (size === 'small') logicalHeight = 12;
    if (size === 'large') logicalHeight = 48;
    if (size === 'xlarge') logicalHeight = 96;

    // We render 2 pixels per line (Top/Bottom half-blocks)
    const pixelHeight = logicalHeight * 2;
    const pixelWidth = pixelHeight; // Square aspect ratio 1:1

    const frames: Record<Direction, string[]> = { right: [], left: [] };
    
    // Sub-function to process a single image file
    const processContent = async (p: string): Promise<string> => {
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
            
            return rows.join('\n');
            
        } catch (e) {
            return ''; 
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
export const LlamaAnimation: React.FC<LlamaAnimationProps> = ({ size = 'small' }) => {
    const [frames, setFrames] = useState<Record<Direction, string[]> | null>(null);
    const [frameIdx, setFrameIdx] = useState(0);
    const [direction, setDirection] = useState<Direction>('right');
    const [step, setStep] = useState(0);

    // 1. Load Assets
    useEffect(() => {
        loadLlamaFrames(size).then(setFrames);
    }, [size]);

    // 2. Animation Loop (100ms)
    useEffect(() => {
        if (!frames) return;

        const timer = setInterval(() => {
            // Cycle frames
            setFrameIdx(f => (f + 1) % 6);
            
            // Bounce Logic
            setStep(prev => {
                const maxSteps = 90; // Increased to 90 (approx 9 seconds / 9 cycles)
                let next = prev;
                
                if (direction === 'right') {
                    next++;
                    if (next >= maxSteps) setDirection('left');
                } else {
                    next--;
                    if (next <= 0) setDirection('right');
                }
                return next;
            });
        }, 100);

        return () => clearInterval(timer);
    }, [frames, direction]);

    if (!frames) return null; // Or <Text>Loading...</Text>

    const currentFrame = frames[direction][frameIdx];

    return (
        <Box paddingLeft={step}>
            <Text wrap="truncate">{currentFrame}</Text>
        </Box>
    );
};
