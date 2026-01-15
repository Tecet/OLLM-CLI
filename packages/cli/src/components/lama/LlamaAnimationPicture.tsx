import React, { useState, useEffect, useReducer, memo, useRef } from 'react';
import { Box, Text, useStdout } from 'ink';
import terminalImage from 'terminal-image';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

// --- CONFIGURATION ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_PATH = path.resolve(__dirname, 'lama_sprite');

type Direction = 'left' | 'right';
type Size = 'standard' | 'small' | 'xsmall' | 'large' | 'xlarge';

interface LlamaAnimationProps {
    size?: Size;
    paddingLeft?: number;
    movementRatio?: number;
    movementWidth?: number;
}

// Pre-rendered frame cache
interface FrameCache {
    right: string[];
    left: string[];
}

// Get the frame file path for a given direction and frame index
function getFramePath(direction: Direction, frameIdx: number): string {
    const prefix = direction === 'right' ? 'r' : 'l';
    return path.join(ASSETS_PATH, direction, `llama-${prefix}${frameIdx + 1}.png`);
}

// Pre-render all frames to terminal strings using terminal-image
async function preRenderFrames(height: number): Promise<FrameCache | null> {
    try {
        const cache: FrameCache = { right: [], left: [] };
        
        for (let i = 0; i < 6; i++) {
            // Render right-facing frames
            const rightPath = getFramePath('right', i);
            const rightBuffer = await fs.readFile(rightPath);
            const rightStr = await terminalImage.buffer(rightBuffer, {
                height,
                preserveAspectRatio: true
            });
            cache.right.push(rightStr);
            
            // Render left-facing frames
            const leftPath = getFramePath('left', i);
            const leftBuffer = await fs.readFile(leftPath);
            const leftStr = await terminalImage.buffer(leftBuffer, {
                height,
                preserveAspectRatio: true
            });
            cache.left.push(leftStr);
        }
        
        return cache;
    } catch (e) {
        console.error('Failed to pre-render frames:', e);
        return null;
    }
}

export const LlamaAnimationSixel: React.FC<LlamaAnimationProps> = memo(({ 
    size = 'small', 
    paddingLeft: initialPadding = 0, 
    movementRatio = 1, 
    movementWidth 
}) => {
    const [frames, setFrames] = useState<FrameCache | null>(null);
    const [animationState, dispatch] = useReducer(
        (state: { frameIdx: number; step: number; direction: Direction; maxSteps: number }, 
         action: { type: 'tick'; maxSteps: number; frameCount: number }) => {
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

    // Calculate dimensions based on size
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

    // Pre-render frames on mount
    useEffect(() => {
        preRenderFrames(logicalHeight).then(setFrames);
    }, [logicalHeight]);

    // Animation timer
    useEffect(() => {
        if (!frames || !isInteractive) return;

        const timer = setInterval(() => {
            dispatch({ type: 'tick', maxSteps: computedMaxSteps, frameCount: 6 });
        }, 120);

        return () => clearInterval(timer);
    }, [frames, isInteractive, computedMaxSteps]);

    if (!frames) return null;

    // Calculate position
    const maxLeftSpacing = Math.max(0, dynamicWidth - spriteWidth);
    const leftSpacing = Math.min(paddedInitial + step, maxLeftSpacing);

    // Get current frame
    const currentFrame = frames[direction][frameIdx] || '';

    return (
        <Box height={logicalHeight} width={dynamicWidth} overflow="hidden">
            <Box marginLeft={leftSpacing}>
                <Text>{currentFrame}</Text>
            </Box>
        </Box>
    );
});

LlamaAnimationSixel.displayName = 'LlamaAnimationSixel';
