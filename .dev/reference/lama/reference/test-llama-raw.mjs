import { Jimp, intToRGBA } from 'jimp';
// If Jimp is default export in this version:
// import Jimp from 'jimp'; 
// But recent Jimp v1 has named export mostly.
// console.log('Jimp object keys:', Object.keys({Jimp})); 
// Commented out verify logic

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_PATH = path.join(__dirname, '../docs/lama_sprite');

const FRAME_DELAY = 100;
const STEP_SIZE = 1; // chars movement

const TARGET_HEIGHT = 12; // 1/4 of original 48px, 1/2 of previous 24px

// Helper: Convert Jimp image to ANSI string
// Each pixel becomes 1 space with background color (Compact mode to prevent wrapping)
async function imageToAnsi(filepath) {
    try {
        const image = await Jimp.read(filepath);
        
        // Resize to make it smaller
        // Jimp v1 uses object syntax often or strict typing
        image.resize({ h: TARGET_HEIGHT }); 
        // Auto width is default if not specified or set to -1 in some vers, 
        // but 'resize({ h: 24 })' is usually safe in new API or check logic.
        
        const w = image.bitmap.width;
        const h = image.bitmap.height;
        let output = '';

        for (let y = 0; y < h; y++) {
            let row = '';
            for (let x = 0; x < w; x++) {
                const { r, g, b, a } = intToRGBA(image.getPixelColor(x, y));
                // a is alpha 0-255
                if (a < 50) {
                    row += '\x1b[0m '; // Transparent (1 space)
                } else {
                    row += `\x1b[48;2;${r};${g};${b}m `; // Colored block (1 space)
                }
            }
            output += row + '\x1b[0m\n'; // Reset and newline
        }
        return { str: output, w, h };
    } catch (err) {
        console.error('Error loading image (Jimp):', filepath);
        console.error(err.message || String(err));
        return { str: `[Error: ${path.basename(filepath)}]`, w: 0, h: 0 };
    }
}

const loadFrames = async () => {
    const frames = { right: [], left: [], size: { w: 0, h: 0 } };
    console.log('Loading sprites, resizing to 24px height...');
    
    for (let i = 1; i <= 6; i++) {
        const rRes = await imageToAnsi(path.join(ASSETS_PATH, 'right', `llama-r${i}.png`));
        if (typeof rRes.str === 'string' && rRes.str.startsWith('[Error')) { process.exit(1); }
        frames.right.push(rRes.str);
        if (i===1) frames.size = { w: rRes.w, h: rRes.h };
        
        const lRes = await imageToAnsi(path.join(ASSETS_PATH, 'left', `llama-l${i}.png`));
        if (typeof lRes.str === 'string' && lRes.str.startsWith('[Error')) { process.exit(1); }
        frames.left.push(lRes.str);
    }
    return frames;
};

const runAnimation = async () => {
    const frames = await loadFrames();
    
    let direction = 'right';
    let frameIdx = 0;
    
    // Logic: 1 step = 1 frame for this raw demo.
    // 5 jumps * 6 frames/jump = 30 steps per direction.
    const maxSteps = 30; 
    let step = 0;
    
    console.log('\x1b[2J'); // Clear screen once

    setInterval(() => {
        // Clear screen and home cursor
        process.stdout.write('\x1b[2J\x1b[H');
        
        console.log(`\x1b[32m--- Llama Animation Test (Compact Mode) ---\x1b[0m`);
        console.log(`Term Width: ${process.stdout.columns} chars`);
        console.log(`Dir: ${direction} | Step: ${step}/${maxSteps} | Frame: ${frameIdx + 1}   `);
        console.log('\x1b[90m----------------------------------------\x1b[0m');

        // Render with padding for movement
        const padding = ' '.repeat(step); // 1 space per step (matching compact mode)
        const imgStr = frames[direction][frameIdx];
        
        const lines = imgStr.split('\n');
        lines.forEach(line => {
            if (line) process.stdout.write(padding + line + '\n');
        });
        
        console.log('\x1b[90m----------------------------------------\x1b[0m');

        // Update loop state
        frameIdx = (frameIdx + 1) % 6;
        
        if (direction === 'right') {
            step++;
            if (step >= maxSteps) {
                direction = 'left';
                // step = maxSteps; // Stay at edge for one frame? 
                // Or flip immediately. 
            }
        } else {
            step--;
            if (step <= 0) {
                direction = 'right';
                // step = 0;
            }
        }
        
    }, FRAME_DELAY);
};

runAnimation();
