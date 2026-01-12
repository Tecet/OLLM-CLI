
import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import { Jimp, ResizeStrategy } from 'jimp';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_PATH = path.join(__dirname, '../docs/lama_sprite');

// Type definitions
type Direction = 'left' | 'right';
type Size = 'standard' | 'small';

function intToRGBA(i: number) {
    return {
        r: (i >>> 24) & 0xFF,
        g: (i >>> 16) & 0xFF,
        b: (i >>> 8) & 0xFF,
        a: i & 0xFF
    };
}

// Image Loader Logic
async function loadLlamaFrames(size: Size) {
    // Standard = 24px height, Small = 12px height
    const targetHeight = size === 'small' ? 12 : 24;
    const frames: Record<Direction, string[]> = { right: [], left: [] };
    
    // Helper to process one image
    const process = async (p: string) => {
        try {
            const image = await Jimp.read(p);
            // Manual Nearest Neighbor Resizing
            // Skip Jimp's resize/scale to avoid any interpolation artifacts
            
            const origW = image.bitmap.width;
            const origH = image.bitmap.height;
            const targetW = targetHeight; // Assuming square aspect ratio for llama
            
            let output = '';

            for (let y = 0; y < targetHeight; y++) {
                let row = '';
                for (let x = 0; x < targetW; x++) {
                    // Calculate source position
                    const srcX = Math.floor(x * (origW / targetW));
                    const srcY = Math.floor(y * (origH / targetHeight));
                    
                    const color = intToRGBA(image.getPixelColor(srcX, srcY));
                    
                    // Strict alpha threshold for crisper edges
                    if (color.a < 128) {
                        row += '\x1b[0m '; // Reset style + Space (Transparent)
                    } else {
                        // ANSI Background color
                        row += `\x1b[48;2;${color.r};${color.g};${color.b}m `; 
                    }
                }
                output += row + '\x1b[0m\n';
            }
            return output.trimEnd(); // Remove trailing newline to prevent Ink height jitter
        } catch (e) {
            return `[Error: ${path.basename(p)}]`;
        }
    };

    // Load all frames
    for (let i = 1; i <= 6; i++) {
        frames.right.push(await process(path.join(ASSETS_PATH, 'right', `llama-r${i}.png`)));
        frames.left.push(await process(path.join(ASSETS_PATH, 'left', `llama-l${i}.png`)));
    }
    return frames;
}

const LlamaAnimation = ({ size = 'small' }: { size?: Size }) => {
    const [frames, setFrames] = useState<Record<Direction, string[]> | null>(null);
    const [frameIdx, setFrameIdx] = useState(0);
    const [direction, setDirection] = useState<Direction>('right');
    const [step, setStep] = useState(0);

    // Initial Load
    useEffect(() => {
        loadLlamaFrames(size).then(setFrames);
    }, [size]);

    // Animation Loop
    useEffect(() => {
        if (!frames) return;
        const timer = setInterval(() => {
            setFrameIdx(f => (f + 1) % 6);
            
            setStep(prev => {
                const maxSteps = 30;
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
    }, [frames, direction]); // depend on direction to catch updates

    if (!frames) return <Text color="yellow">Loading assets...</Text>;

    const currentFrame = frames[direction][frameIdx];

    return (
        <Box flexDirection="column" borderStyle="round" borderColor="green" padding={1}>
            <Text bold color="green"> Ink Project Environment Test </Text>
            <Text color="gray"> Mode: {size} (Compact ANSI) </Text>
            <Text> Dir: {direction} | Pos: {step} </Text>
            
            {/* The animation stage */}
            <Box paddingLeft={step} marginTop={1}>
                {/* We render the raw ANSI string inside a Text component */}
                <Text>{currentFrame}</Text>
            </Box>
        </Box>
    );
};

const App = () => {
    return (
        <Box flexDirection="column" gap={1}>
            <LlamaAnimation size="small" />
            <LlamaAnimation size="standard" />
        </Box>
    );
};

render(<App />);
