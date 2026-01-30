#!/usr/bin/env node

import { writeFileSync } from 'fs';

import { Jimp } from 'jimp';

const ASCII_CHARS = ['@', '#', 'S', '%', '?', '*', '+', ';', ':', ',', '.', ' '];

// Convert RGB to hex color
function rgbToHex(r, g, b) {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
  );
}

// Calculate brightness from RGB
function getBrightness(r, g, b) {
  return (r + g + b) / 3;
}

async function convertImageToColoredAscii(imagePath, width = 80) {
  try {
    // Read the image
    const image = await Jimp.read(imagePath);

    // Calculate height to maintain aspect ratio
    const aspectRatio = image.bitmap.height / image.bitmap.width;
    const height = Math.floor(width * aspectRatio * 0.5); // 0.5 because characters are taller than wide

    // Resize image
    image.resize({ w: width, h: height });

    let asciiArt = '';
    let colorData = [];

    // Convert each pixel to ASCII with color
    for (let y = 0; y < height; y++) {
      let line = '';
      let lineColors = [];

      for (let x = 0; x < width; x++) {
        const pixel = image.getPixelColor(x, y);

        // Extract RGB values (Jimp stores as RGBA in a 32-bit integer)
        const r = (pixel >> 24) & 0xff;
        const g = (pixel >> 16) & 0xff;
        const b = (pixel >> 8) & 0xff;
        const a = pixel & 0xff;

        // Calculate brightness (0-255)
        const brightness = getBrightness(r, g, b);

        // Map brightness to ASCII character
        const charIndex = Math.floor((brightness / 255) * (ASCII_CHARS.length - 1));
        const char = ASCII_CHARS[ASCII_CHARS.length - 1 - charIndex];

        line += char;

        // Store color if not transparent and not too dark
        if (a > 128 && brightness > 20) {
          lineColors.push({
            char,
            color: rgbToHex(r, g, b),
            x,
          });
        } else {
          lineColors.push(null);
        }
      }

      asciiArt += line + '\n';
      colorData.push(lineColors);
    }

    return { asciiArt, colorData, width, height };
  } catch (error) {
    console.error('Error converting image:', error);
    throw error;
  }
}

// Generate TypeScript code for colored ASCII
function generateColoredAsciiCode(data) {
  const { asciiArt, colorData } = data;

  // Analyze colors to find dominant ones
  const colorMap = new Map();
  colorData.forEach((line) => {
    line.forEach((pixel) => {
      if (pixel && pixel.color) {
        colorMap.set(pixel.color, (colorMap.get(pixel.color) || 0) + 1);
      }
    });
  });

  // Get top colors
  const sortedColors = Array.from(colorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.log('\nTop colors found:');
  sortedColors.forEach(([color, count]) => {
    console.log(`  ${color}: ${count} pixels`);
  });

  // Generate line-by-line colored output
  let tsCode = `// ASCII art with colors from original image\n`;
  tsCode += `const WELCOME_ASCII_LINES = [\n`;

  const lines = asciiArt.split('\n');
  lines.forEach((line, y) => {
    if (y >= colorData.length) return;

    const lineColorData = colorData[y];
    const segments = [];
    let currentColor = null;
    let currentText = '';

    for (let x = 0; x < line.length; x++) {
      const pixel = lineColorData[x];
      const char = line[x];
      const color = pixel?.color || null;

      if (color === currentColor) {
        currentText += char;
      } else {
        if (currentText) {
          segments.push({ text: currentText, color: currentColor });
        }
        currentColor = color;
        currentText = char;
      }
    }

    if (currentText) {
      segments.push({ text: currentText, color: currentColor });
    }

    // Generate line code
    tsCode += `  { segments: [\n`;
    segments.forEach((seg) => {
      const escapedText = seg.text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      if (seg.color) {
        tsCode += `    { text: '${escapedText}', color: '${seg.color}' },\n`;
      } else {
        tsCode += `    { text: '${escapedText}' },\n`;
      }
    });
    tsCode += `  ]},\n`;
  });

  tsCode += `];\n`;

  return tsCode;
}

// Main execution
const imagePath = 'welcome.png';
const outputPath = 'welcome-ascii-colored.ts';

console.log('Converting image to colored ASCII art...');
console.log('Image path:', imagePath);

convertImageToColoredAscii(imagePath, 80)
  .then((data) => {
    const tsCode = generateColoredAsciiCode(data);
    writeFileSync(outputPath, tsCode, 'utf-8');
    console.log(`\nColored ASCII TypeScript code saved to: ${outputPath}`);
    console.log('\nPlain ASCII preview:');
    console.log(data.asciiArt);
  })
  .catch((error) => {
    console.error('Failed:', error.message);
    process.exit(1);
  });
