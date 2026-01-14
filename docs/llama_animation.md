# Llama Animation Guide

The walking llama animation provides visual feedback during the "waiting for token" state. It uses advanced high-density block rendering to display detailed pixel art in standard terminals without needing special image protocols.

---

## Technical Implementation

### High-Density Rendering
To achieve high detail in a small vertical space, we use **Half-Block Rendering** (`▀`).
- **Standard ANSI**: 1 character height = 1 pixel.
- **High-Density**: 1 character height = 2 vertical pixels (Foreground + Background colors).

This effectively **doubles the vertical resolution**, allowing a 48px tall image to be displayed in just 24 lines of text.

### Adaptive Scaling
We use a hybrid approach to ensure the best quality at every size:

- **Small & Standard** (Downscale/Native): Use **Nearest Neighbor Sampling**.
    - **Why?** Preserves exact 1:1 pixel colors and sharp edges. Bicubic interpolation at these sizes causes "blurring" and "washed out" colors.
- **Large & XL** (Upscale): Use **Bicubic Interpolation**.
    - **Why?** Generates smooth intermediate pixels when zooming in (2x/4x), preventing giant jagged blocks.

### Supported Sizes
1. **Small (`size="small"`)**: 12 lines tall (Effective 24px)
2. **Standard (`size="standard"`)**: 24 lines tall (Effective 48px - Native)
3. **Large (`size="large"`)**: 48 lines tall (Effective 96px)
4. **Extra Large (`size="xlarge"`)**: 96 lines tall (Effective 192px)

---

## File Structure

```
packages/cli/
└── src/
    └── components/
        └── lama/
            ├── LlamaAnimation.tsx     # Core component used throughout the CLI
            ├── lama_sprite/           # PNG assets (active)
            ├── reference/             # Legacy reference scripts (backup)
            └── demo.tsx               # Reusable CLI-specific demo harness
```

Backup copies of everything in the `lama/` folder live under `.dev/reference/lama/` so you can restore the previous iteration anytime.

---

## How-To: Change Animation Length

The distance the llama walks before turning around is controlled by the `maxSteps` variable in the code.

1. Open `packages/cli/src/components/lama/LlamaAnimation.tsx`.
2. Locate the `setStep` update function inside `useEffect`:

```typescript
// Bounce Logic
setStep(prev => {
    const maxSteps = 90; // <--- CHANGE THIS VALUE
    let next = prev;
    // ...
```

### Reference Values:
- **`30`**: Short walk (~3 seconds), good for small loading bars.
- **`90`**: Medium walk (~9 seconds), standard patrol.
- **`200`**: Long walk (~20 seconds), for full-width headers.

**Note:** Changing this value does NOT require re-rendering images. It simply adjusts the layout padding limit.

---

## Running Verification Tests

We have a dedicated test suite in `packages/cli/src/components/lama/reference/` to verify the rendering quality and stability (the same scripts are mirrored for safekeeping at `.dev/reference/lama/reference/`).

**Small:**
```bash
npx tsx packages/cli/src/components/lama/reference/jumping_lama_small.tsx
```

**Standard:**
```bash
npx tsx packages/cli/src/components/lama/reference/jumping_lama_standard.tsx
```

**Large (High Detail):**
```bash
npx tsx packages/cli/src/components/lama/reference/jumping_lama_l.tsx
```

**Extra Large (Giant):**
```bash
npx tsx packages/cli/src/components/lama/reference/jumping_lama_xl.tsx
```
*(Requires a maximized terminal window)*

## Active Demo

For a CLI-native demo that renders both `small` and `standard` animations, run `packages/cli/src/components/lama/demo.tsx`. A backup of that demo resides at `.dev/reference/lama/demo.tsx`.

```bash
npx tsx packages/cli/src/components/lama/demo.tsx
```
