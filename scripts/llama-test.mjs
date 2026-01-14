import { Jimp, ResizeStrategy } from 'jimp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_PATH = path.resolve(__dirname, '../packages/cli/src/components/lama/lama_sprite');

function intToRGBA(i) {
  return {
    r: (i >>> 24) & 0xff,
    g: (i >>> 16) & 0xff,
    b: (i >>> 8) & 0xff,
    a: i & 0xff,
  };
}

async function processContent(p, logicalHeight, pixelWidth, pixelHeight, size) {
  const image = await Jimp.read(p);
  const origW = image.bitmap.width;
  const origH = image.bitmap.height;
  const isUpscale = pixelHeight > origH || size === 'xsmall';
  if (isUpscale) {
    image.resize({ w: pixelWidth, h: pixelHeight, mode: ResizeStrategy.BICUBIC });
  }
  const rows = [];
  for (let y = 0; y < logicalHeight; y++) {
    let row = '';
    for (let x = 0; x < pixelWidth; x++) {
      let cTop, cBot;
      if (isUpscale) {
        cTop = intToRGBA(image.getPixelColor(x, y * 2));
        cBot = intToRGBA(image.getPixelColor(x, y * 2 + 1));
      } else {
        const srcX = Math.floor(x * (origW / pixelWidth));
        const srcY_Top = Math.floor((y * 2) * (origH / pixelHeight));
        const srcY_Bot = Math.floor((y * 2 + 1) * (origH / pixelHeight));
        cTop = intToRGBA(image.getPixelColor(srcX, srcY_Top));
        cBot = intToRGBA(image.getPixelColor(srcX, srcY_Bot));
      }
      const topVisible = cTop.a >= 128;
      const botVisible = cBot.a >= 128;
      if (topVisible && botVisible) {
        row += `\x1b[38;2;${cTop.r};${cTop.g};${cTop.b}m\x1b[48;2;${cBot.r};${cBot.g};${cBot.b}m▀`;
      } else if (topVisible && !botVisible) {
        row += `\x1b[38;2;${cTop.r};${cTop.g};${cTop.b}m\x1b[49m▀`;
      } else if (!topVisible && botVisible) {
        row += `\x1b[38;2;${cBot.r};${cBot.g};${cBot.b}m\x1b[49m▄`;
      } else {
        row += `\x1b[0m `;
      }
    }
    rows.push(row + '\x1b[0m');
  }
  return rows.join('\n');
}

async function run() {
  const size = 'small';
  let logicalHeight = 24;
  if (size === 'xsmall') logicalHeight = 7;
  if (size === 'small') logicalHeight = 12;
  if (size === 'large') logicalHeight = 48;
  if (size === 'xlarge') logicalHeight = 96;
  const pixelHeight = logicalHeight * 2;
  const pixelWidth = pixelHeight;
  const frame = await processContent(
    path.join(ASSETS_PATH, 'right', 'llama-r1.png'),
    logicalHeight,
    pixelWidth,
    pixelHeight,
    size
  );
  console.log('frame length', frame.length);
  console.log('frame snippet', frame.slice(0, 200));
}

run().catch((err) => console.error(err));
