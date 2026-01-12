
import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import path from 'path';
import { fileURLToPath } from 'url';
import terminalImage from 'terminal-image';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CONFIG
const LLAMA_WIDTH_PX = 48;
const STEP_SIZE_PX = 8;
const FRAME_DURATION_MS = 80;
const CONTAINER_WIDTH_PX = 432; 

// PATHS
const ASSETS_PATH = path.join(__dirname, '../docs/lama_sprite');

// Pre-load logic
const loadFrames = async () => {
    const frames = { right: [], left: [] };
    
    console.log('Pre-loading sprite frames...');
    for (let i = 1; i <= 6; i++) {
        const rPath = path.join(ASSETS_PATH, 'right', `llama-r${i}.png`);
        const lPath = path.join(ASSETS_PATH, 'left', `llama-l${i}.png`);
        
        try {
            // Options: {width: '100%'} or approximate char width. 
            // 48px / 2 (approx pixel aspect ratio) = ~24 chars width?
            // terminal-image defaults to 1:1 pixel to char if we don't scale.
            // Let's rely on default or set specific options if needed.
            // For 48px width, we might want to let it decide or force a width.
            const rImg = await terminalImage.file(rPath);
            const lImg = await terminalImage.file(lPath);
            frames.right.push(rImg);
            frames.left.push(lImg);
        } catch (e) {
            console.error(`Failed to load frame ${i}:`, e.message);
            // Fallback text
            frames.right.push(`[R${i}]`);
            frames.left.push(`[L${i}]`);
        }
    }
    return frames;
};

const LlamaTest = ({ frames }) => {
    const [pos, setPos] = useState(0);
    const [direction, setDirection] = useState('right');
    const [frameIndex, setFrameIndex] = useState(0); // 0-5
    
    const maxPos = CONTAINER_WIDTH_PX - LLAMA_WIDTH_PX;
    
    useEffect(() => {
        const timer = setInterval(() => {
            setPos((prevPos) => {
                let newPos = prevPos;
                let newDir = direction;
                
                if (direction === 'right') {
                    newPos += STEP_SIZE_PX;
                    if (newPos >= maxPos) {
                        newPos = maxPos;
                        setDirection('left');
                    }
                } else {
                    newPos -= STEP_SIZE_PX;
                    if (newPos <= 0) {
                        newPos = 0;
                        setDirection('right');
                    }
                }
                
                // Cycle frames 0-5
                setFrameIndex(prev => (prev + 1) % 6);
                
                if (newDir !== direction) setDirection(newDir);
                
                return newPos;
            });
        }, FRAME_DURATION_MS);

        return () => clearInterval(timer);
    }, [direction, maxPos]);

    const currentFrame = frames[direction][frameIndex];
    const marginLeft = Math.floor(pos / 8);

    return (
        React.createElement(Box, { flexDirection: "column", padding: 2, borderStyle: "round", borderColor: "green" },
            React.createElement(Text, { bold: true, color: "green" }, "Llama Animation Test"),
            React.createElement(Text, { dimColor: true }, "Cycle: Right -> Flip -> Left -> Flip"),
            React.createElement(Text, { dimColor: true }, `Pos: ${pos}px / ${maxPos}px | Frame: ${frameIndex+1} | Dir: ${direction.toUpperCase()}`),
            React.createElement(Box, { marginTop: 1, paddingBottom: 1, borderStyle: "single", borderColor: "gray", width: 70 },
                React.createElement(Box, { marginLeft: marginLeft },
                   React.createElement(Text, {}, currentFrame)
                )
            )
        )
    );
};

// Bootstrap
(async () => {
    try {
        const frames = await loadFrames();
        render(React.createElement(LlamaTest, { frames }));
    } catch (err) {
        console.error(err);
    }
})();
