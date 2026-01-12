
import terminalImage from 'terminal-image';
import { Jimp } from 'jimp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_PATH = path.join(__dirname, '../docs/lama_sprite');

const FRAME_DELAY = 100;
const RESIZE_WIDTH = 24; // Resize to smaller pixel width for better fit, preserving aspect ratio

const loadFrames = async () => {
    const frames = { right: [], left: [] };
    console.log('Loading PNG sprites...');
    
    // We'll use Jimp to resize first to control the "physical" size of the image,
    // then pass the buffer to terminal-image. 
    // This allows real constraints on dimensions while keeping PNG quality (colors/transparency).
    
    for (let i = 1; i <= 6; i++) {
        // RIGHT
        const rPath = path.join(ASSETS_PATH, 'right', `llama-r${i}.png`);
        console.log(`Reading ${rPath}...`);
        const rImg = await Jimp.read(rPath);
        
        if (RESIZE_WIDTH) {
             console.log(`Resizing R${i}...`);
             rImg.resize({ w: RESIZE_WIDTH });
        }
        
        console.log(`Getting buffer R${i}...`);
        const rBuf = await new Promise((resolve, reject) => {
            rImg.getBuffer('image/png', (err, buf) => {
                if (err) reject(err);
                else resolve(buf);
            });
        });
        
        console.log(`Frame R${i} buf size: ${rBuf.length}`);
        const ansi = await terminalImage.buffer(rBuf);
        console.log(`Frame R${i} ansi len: ${ansi.length}`);
        frames.right.push(ansi);
        
        // LEFT
        const lPath = path.join(ASSETS_PATH, 'left', `llama-l${i}.png`);
        console.log(`Reading ${lPath}...`);
        const lImg = await Jimp.read(lPath);
        if (RESIZE_WIDTH) lImg.resize({ w: RESIZE_WIDTH });
        
        const lBuf = await new Promise((resolve, reject) => {
            lImg.getBuffer('image/png', (err, buf) => {
                 if (err) reject(err);
                 else resolve(buf);
            });
        });
        frames.left.push(await terminalImage.buffer(lBuf));
    }
    return frames;
};

const runAnimation = async () => {
    try {
        const frames = await loadFrames();
        let direction = 'right';
        let frameIdx = 0;
        let step = 0;
        const maxSteps = 30;

        console.log('\x1b[2J'); // Clear screen

        setInterval(() => {
            // Clear screen and home cursor
            process.stdout.write('\x1b[2J\x1b[H');
            
            console.log(`\x1b[35m--- Llama Animation Test (Real PNG) ---\x1b[0m`);
            console.log(`Dir: ${direction} | Step: ${step}/${maxSteps} | Frame: ${frameIdx + 1}`);
            console.log('\x1b[90m----------------------------------------\x1b[0m');

            const padding = ' '.repeat(step); 
            // For real images (iTerm protocol), they are usually one line or a block.
            // If it's a block string, we need to pad each line.
            
            const imgStr = frames[direction][frameIdx];
            const lines = imgStr.split('\n');
            lines.forEach(line => {
                if (line) process.stdout.write(padding + line + '\n');
            });

            console.log('\x1b[90m----------------------------------------\x1b[0m');

            // Update state
            frameIdx = (frameIdx + 1) % 6;
            
            if (direction === 'right') {
                step++;
                if (step >= maxSteps) direction = 'left';
            } else {
                step--;
                if (step <= 0) direction = 'right';
            }

        }, FRAME_DELAY);
    } catch (e) {
        console.error('Failed to run animation:', e);
    }
};

runAnimation();
