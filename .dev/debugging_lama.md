# Debugging Llama Animation

This note is the single recovery point for anyone brought back into the CLI stack after a crash, context loss, or agent rollover. Treat it as the language reference for the llama animation subsystem so debugging agents always start in the same place.

## Intent
- Explain the animation technology stack (TypeScript + React + Ink + Jimp) so agents know what tools to reach for.
- Explain the animation script flow so that reproductions do not depend on scattered commits.
- Capture the commands and files you need to rerun or inspect immediately when the animation renders incorrectly.

## Key files
- packages/cli/src/components/lama/LlamaAnimation.tsx (React + Ink component that loads 6-frame sprites, converts them to ANSI half-block output, and bounces the llama inside a terminal-width box)
- packages/cli/src/components/lama/demo.tsx (Ink layout that renders the small and standard animations for live verification)
- docs/llama_animation.md (conceptual guide describing pixel precision, adaptive scaling, supported sizes, and verification commands)
- .kiro/specs/stage-06-cli-ui (design + requirements + tasks reference that connects animation behavior to waiting-for-response states, launch screen, and chat history expectations)

## Technology briefing
1. **Language:** TypeScript targeting ESM, rendered through React (Ink) in Node, with ESM-only imports (e.g., `import { LlamaAnimation } from './LlamaAnimation.js'`).
2. **Rendering:** Frames generated via Jimp (nearest neighbor for small/standard, bicubic for large/xlarge). Half-block rendering uses ANSI escape sequences (`▀`, `▄`) and explicit resets per row (`\x1b[0m`).
3. **Control loop:** `loadLlamaFrames` produces two direction arrays (right/left) of strings; a reducer drives the `frameIdx`, `step`, and `direction` inside `LlamaAnimation`. Movement width is computed from the terminal width and optional `movementWidth`/`movementRatio` props, and `maxSteps` determines the patrol distance.
4. **Assets:** `lama_sprite/right/llama-r1.png` … `llama-r6.png` plus `lama_sprite/left/llama-l1.png` … `llama-l6.png`. They live next to the component; `.dev/reference/lama` keeps backups.

## Known problem areas
- **Frame loading failures:** If any `Jimp.read()` rejects (e.g., missing asset or unsupported format), the component now returns an empty string and the animation unmounts quietly. Watch the console for Jimp errors and double-check the computed `ASSETS_PATH` (`path.resolve(__dirname, 'lama_sprite')`).
- **Terminal metrics:** If `stdout.columns` is undefined when Ink renders, the movement width computation may underflow, causing `computedMaxSteps` to become negative. Reproduce the issue in shells without full TTY metadata and log the computed spacing values.
- **Half-block escape sequences:** ANSI codes must reset each row (`rows.push(row + '\x1b[0m')`). If trailing styles bleed into other UI elements, ensure the reducer uses `currentFrame` per render and that the `Text` component wraps with `truncate`.

## Debugging recipe
1. **Start here:** Reopen this file when you notice animation issues so you know where to start.
2. **Run the demo:** `npx tsx packages/cli/src/components/lama/demo.tsx` isolates the llama animation from the rest of the CLI and shows small + standard variants.
3. **Inspect frame generation:** Insert logging inside `loadLlamaFrames` to emit `rows.length`, `logicalHeight`, and `currentFrame` before returning to track where frames become empty.
4. **Monitor terminal width:** Add `console.debug({ columns: stdout?.columns, movementWidth, spriteWidth, computedMaxSteps })` inside `LlamaAnimation` to verify spacing values when bouncing fails.
5. **Adjust `maxSteps`:** The patrol distance is set by `maxSteps = 90` inside the reducer; adjust it if the llama never turns or clips.
6. **Verify assets:** Use the reference scripts listed in `docs/llama_animation.md` (e.g., `npx tsx packages/cli/src/components/lama/reference/jumping_lama_standard.tsx`) to ensure PNGs still render correctly.
7. **Recovery:** If the animation state is lost due to a crash, rerun the demo, review this note, and consult `.kiro/specs/stage-06-cli-ui/requirements.md` requirement 8 to realign behavior with the chat/waiting experience.

## Logging format (required)
Every bug attempt must include a timestamped **plan** and **result**. Use ISO 8601 local time with offset (example: `2026-01-14T21:08:33-08:00`). Keep entries short and factual. This format is required so the file can be used as a system prompt for future debugging.

### Bug log template
```
## Bug Log: <short bug title>
- **Issue:** <one-line summary>
- **Symptoms:** <what the user sees>
- **Scope:** <where it fails; where it still works>

### Attempts
1. **Timestamp:** <YYYY-MM-DDThh:mm:ss±hh:mm>
  **Hypothesis:** <why it might be failing>
  **Plan:** <what will be changed or tested>
  **Action:** <commands/files touched>
  **Result:** <observed outcome>
  **Next step:** <what to try next>

2. **Timestamp:** <YYYY-MM-DDThh:mm:ss±hh:mm>
  **Hypothesis:** ...
  **Plan:** ...
  **Action:** ...
  **Result:** ...
  **Next step:** ...
```

## Context recovery
- After context loss, rerun the demo command before editing any TypeScript files.
- The animation integrates with the launch screen and waiting states; refer to `.kiro/specs/stage-06-cli-ui/design.md` sections that mention `LlamaAnimation` to reestablish where it fits in the UI.
- Update this file whenever you discover a new debugging command or asset location so future agents can restart from here.

## Bug Log: Welcome Screen Missing Animation
- **Issue (2026-01-14):** Welcome screen shows only a black cursor moving across the area reserved for the llama animation, while the animation worked intermittently before ultimately disappearing after multiple fixes.
- **Symptoms:** Launch screen renders but no llama frames appear; the blank space contains only a blinking cursor even though `LlamaAnimation` was previously detected there.
- **Diagnosis notes:** The animation still renders in `packages/cli/src/components/lama/demo.tsx`, so assets/renderer are intact; the regression appears when `LlamaAnimation` is mounted inside `LaunchScreen`.
- **Attempts so far (legacy, pre-template):**
  1. Verified animation renders in the standalone demo to confirm frame generation.
  2. Confirmed `loadLlamaFrames` resolves and `frames` is non-null before the component attempts to render inside LaunchScreen.
  3. Logged `currentFrame`, `leftSpacing`, and `rightSpacing` during LaunchScreen rendering; values look valid, but nothing shows visually (possible Ink layout clipping or background overwrite).
- **Next steps:** Add logging inside `LaunchScreen` and surrounding boxes to confirm `movementRatio`, `movementWidth`, and background colors/padding so we can see why the frames don’t appear in that context.
- **Process reminder:** Append every new hypothesis, plan, action, and result here using the template above.

### Attempts
1. **Timestamp:** 2026-01-14T19:14:00-08:00
   **Hypothesis:** The Ink layout/background styling in `LlamaAnimation` is clipping or overriding ANSI sequences when embedded in `LaunchScreen`.
   **Plan:** Simplify the layout to the older padding-based approach and remove background styling so ANSI frames render reliably.
   **Action:** Updated `LlamaAnimation` to render with `paddingLeft` only and removed background colors in the main and duplicate components.
  **Result:** Animation is visible again, but the terminal shakes and the llama flickers.
  **Next step:** Investigate flicker/terminal shake as a new bug.

## Bug Log: Terminal Shakes + Llama Flicker
- **Issue:** Terminal output shakes and the llama animation flickers after restoring the animation.
- **Symptoms:** Whole terminal appears to jitter; llama frames flicker rapidly.
- **Scope:** Happens in launch screen when animation is active.

### Attempts
1. **Timestamp:** 2026-01-14T19:22:00-08:00
  **Hypothesis:** Rapid full-frame ANSI updates or layout reflow are causing terminal jitter.
  **Plan:** Identify which component triggers excessive re-renders and test a fixed-size container / reduced update rate.
  **Action:** Pending.
  **Result:** Pending.
  **Next step:** Add render timing logs and try reducing the animation tick rate.

2. **Timestamp:** 2026-01-14T19:33:00-08:00
  **Hypothesis:** The padding-based layout allows line wrapping, causing the terminal to scroll and duplicate frames.
  **Plan:** Restore left/right spacer boxes with a fixed container width to stabilize the frame width.
  **Action:** Updated `LlamaAnimation` to use spacer boxes and fixed width while keeping ANSI output.
  **Result:** Pending rebuild and runtime verification.
  **Next step:** Rebuild and confirm whether duplicate welcome screens and flicker stop.

## Bug Log: Welcome Screen Duplicates in Terminal
- **Issue:** Multiple copies of the welcome screen appear stacked in the terminal.
- **Symptoms:** Each animation tick seems to print a new full frame instead of updating in place.
- **Scope:** Observed in VS Code integrated terminal; unknown in external terminals.

### Attempts
1. **Timestamp:** 2026-01-14T19:33:00-08:00
  **Hypothesis:** Frame wrapping/scrolling makes Ink output append instead of replace.
  **Plan:** Stabilize the animation layout width to prevent wrapping.
  **Action:** Same change as the terminal shake fix (spacer boxes + fixed width).
  **Result:** Pending rebuild and runtime verification.
  **Next step:** If still duplicating, check TTY detection and force Ink to use a TTY-compatible stdout.

2. **Timestamp:** 2026-01-14T19:42:00-08:00
  **Hypothesis:** The animation container can exceed the parent width, causing line wrapping and scroll.
  **Plan:** Clamp the animation container to the provided `movementWidth` and cap the sprite render width to avoid wrapping.
  **Action:** Updated `LlamaAnimation` to use a fixed `containerWidth` based on `movementWidth` and clamp `renderWidth`.
  **Result:** Pending rebuild and runtime verification.
  **Next step:** Rebuild and verify whether duplicate frames stop in the VS Code terminal.

3. **Timestamp:** 2026-01-14T19:51:00-08:00
  **Hypothesis:** Ink treats VS Code terminal as non-interactive and appends full frames on each animation tick.
  **Plan:** Disable animation updates when `stdout.isTTY` is false; render a static frame instead.
  **Action:** Guarded the animation interval and frame selection based on `stdout.isTTY`.
  **Result:** Pending rebuild and runtime verification.
  **Next step:** Rebuild and check if the welcome screen stops stacking in the terminal.

4. **Timestamp:** 2026-01-14T20:03:00-08:00
  **Hypothesis:** Re-rendering the full launch screen causes the terminal to scroll; we need static sections outside the animation.
  **Plan:** Render header/footer inside `Static` blocks so only the animation container updates.
  **Action:** Wrapped launch header and footer sections in `Static` components.
  **Result:** Animation no longer spams the terminal, but the launch header/quick actions text disappeared.
  **Next step:** Use `Static.Item` blocks to ensure static content renders properly.

5. **Timestamp:** 2026-01-14T20:11:00-08:00
  **Hypothesis:** The `Static` render function usage is suppressing output in this layout.
  **Plan:** Switch to `Static.Item` components for header/footer content.
  **Action:** Replaced the `Static items` + render function with `Static.Item` blocks.
  **Result:** Build/runtime error: `Static.Item` is undefined in Ink v4, causing LaunchScreen to crash.
  **Next step:** Revert to `Static` render function and retest.

6. **Timestamp:** 2026-01-14T20:20:00-08:00
  **Hypothesis:** The Static render-function path is supported and avoids the undefined component error.
  **Plan:** Revert to `Static items` + render function for header/footer while keeping animation isolated.
  **Action:** Restored Static render-function usage.
  **Result:** Launch header still missing; React warns about missing keys in Static.
  **Next step:** Add `key` via the Static render callback and re-test.

7. **Timestamp:** 2026-01-14T20:33:00-08:00
  **Hypothesis:** Static header/footer render is suppressed due to missing keyed elements in the Static render list.
  **Plan:** Use the Static render callback with `item` and add `key={item.id}` to the root node.
  **Action:** Updated Static render callbacks in LaunchScreen to use `item` and add keys.
  **Result:** Only the footer text rendered; hero section still missing.
  **Next step:** Remove Static blocks and memoize header/footer to keep layout intact.

8. **Timestamp:** 2026-01-14T20:45:00-08:00
  **Hypothesis:** Static output is unsuitable for mixed header/animation/footer layout; it suppresses hero content.
  **Plan:** Restore normal layout and memoize header/footer so only the animation updates.
  **Action:** Replaced Static sections with memoized `LaunchHeader` and `LaunchFooter` components.
  **Result:** Full hero returned, but terminal started stacking again with each animation tick.
  **Next step:** Constrain overall layout height to terminal rows to stop scroll.

9. **Timestamp:** 2026-01-14T20:58:00-08:00
  **Hypothesis:** The launch screen exceeds terminal height, causing Ink to scroll and append frames.
  **Plan:** Clamp the root container height to `stdout.rows` and reduce spacing in compact terminals.
  **Action:** Added `height` + `overflow="hidden"` on the root `Box` and compact spacing logic in `LaunchScreen`.
  **Result:** Good progress — stacking stopped in the terminal while keeping the hero visible.
  **Next step:** Monitor for edge cases; add compact mode fallback only if stacking returns.

10. **Timestamp:** 2026-01-14T21:10:00-08:00
  **Hypothesis:** Standard 24-line sprite height and fast tick rate cause flicker and border instability.
  **Plan:** Reduce sprite height to 20 lines and slow the animation tick slightly.
  **Action:** Set standard `logicalHeight` to 20 lines, adjusted LaunchScreen container height, and slowed tick interval to 120ms.
  **Result:** Regression: standard animation went blank (cursor only).
  **Next step:** Align frame generation height with 20-line standard to restore rendering.

11. **Timestamp:** 2026-01-14T21:22:00-08:00
  **Hypothesis:** Frame generation still uses 24-line standard height, causing mismatch with the 20-line container.
  **Plan:** Change `loadLlamaFrames` default standard height to 20 lines.
  **Action:** Updated standard `logicalHeight` in the frame loader to 20 lines in both LlamaAnimation files.
  **Result:** Pending rebuild and runtime verification.
  **Next step:** Rebuild and verify the llama renders with reduced flicker.

12. **Timestamp:** 2026-01-14T21:45:00-08:00
  **Hypothesis:** Size changes don't address root cause; need to research Ink rendering pipeline.
  **Plan:** Revert to 24-line standard height, research Ink docs and flicker solutions.
  **Action:** Reverted `logicalHeight` to 24; researched Ink documentation and `ink-picture` library.
  **Result:** Found root causes and multiple solution options documented below.
  **Next step:** Review and implement one of the proposed solutions.

---

## Root Cause Analysis (2026-01-14)

After extensive research into Ink terminal documentation and the animation implementation, the following root causes were identified:

### 1. Ink 4.x Lacks Anti-Flicker Features
The project uses Ink v4.0.0 (`packages/cli/package.json`), but critical anti-flicker options were added in Ink 6.x:
- `incrementalRendering` - Only updates changed lines instead of redrawing entire output
- `maxFps` - Controls render update frequency (default 30fps)

### 2. Full Frame Redraws on Every Tick
The current approach renders the entire ANSI escape sequence as a single `<Text>` blob. Ink has no way to diff individual lines, so it redraws everything on each 120ms tick, causing flicker.

### 3. ANSI Escape Sequences Conflict with Ink's Rendering
Raw ANSI codes embedded in `<Text>` interfere with Ink's internal rendering pipeline (which uses Yoga for layout), causing visual artifacts and instability.

---

## Proposed Solutions

### Option A: Upgrade to Ink 6.x + Enable `incrementalRendering` ⭐ RECOMMENDED
**Effort:** Low | **Risk:** Medium (breaking changes possible)

1. Upgrade Ink:
   ```bash
   npm install ink@^6.6.0
   ```

2. Modify `packages/cli/src/cli.tsx` line 315:
   ```tsx
   render(<App config={config} />, { incrementalRendering: true, maxFps: 15 });
   ```

**Why this works:** The `incrementalRendering` option was specifically designed to "reduce flickering and improve performance for frequently updating UIs."

---

### Option B: Refactor Animation to Render Rows Individually
**Effort:** Medium | **Risk:** Low

Instead of rendering one giant `<Text>` with the entire frame, render each row as a separate `<Text>` component so Ink can diff individual lines:

Current approach (problematic):
```tsx
<Text wrap="truncate">{currentFrame}</Text>
```

Proposed approach:
```tsx
{rows.map((row, i) => <Text key={i} wrap="truncate">{row}</Text>)}
```

This requires modifying `loadLlamaFrames` to return `string[][]` (array of rows per frame) instead of `string[]` (full frame strings).

---

### Option C: Use `ink-picture` Library
**Effort:** Medium | **Risk:** Medium

The `ink-picture` library (https://github.com/endernoke/ink-picture) handles terminal image rendering with automatic protocol detection and fallbacks:
- Supports Sixel, Kitty, iTerm2, half-block, braille, ASCII
- Auto-detects terminal capabilities
- VS Code integrated terminal supports Sixel (with `terminal.integrated.enableImages` setting)

**Caveat:** The library's documentation notes that high-quality renderers (Kitty, Sixel, iTerm2) "may experience rendering flicker during updates" due to bypassing React/Ink's normal rendering pipeline.

---

### Option D: Use Kitty/Sixel Graphics Protocol Directly
**Effort:** High | **Risk:** High

For terminals that support native graphics protocols (VS Code supports Sixel), render images directly without ANSI half-blocks. This would provide flicker-free rendering but requires:
- Significant refactoring of the rendering pipeline
- Terminal capability detection
- Fallback handling for unsupported terminals

---

## Decision Matrix

| Option | Effort | Risk | Flicker Fix | Compatibility |
|--------|--------|------|-------------|---------------|
| A: Ink 6.x upgrade | Low | Medium | Likely | All terminals |
| B: Row-based rendering | Medium | Low | Partial | All terminals |
| C: ink-picture | Medium | Medium | Partial | Modern terminals |
| D: Sixel/Kitty | High | High | Best | Limited terminals |

---

## Ink 6.x Upgrade Impact Analysis

### Breaking Changes (Ink 4.x → 6.x)

**Ink 5.0.0 (May 2024):**
- Requires Node.js 18+ (project already uses Node 20+) ✅

**Ink 6.0.0 (May 2025):**
- **Requires Node.js 20** ✅ (project uses `"@types/node": "^20.0.0"`)
- **Requires React 19** ⚠️ (project uses `"react": "^18.2.0"` - MUST UPGRADE)
  - See [.dev/react19.md](.dev/react19.md) for full React 19 impact analysis

### New Features in Ink 6.x (beneficial)
- `incrementalRendering` option (v6.5.0) - **KEY FEATURE for animation flicker**
- `maxFps` option (v6.3.0) - Control render frequency
- `onRender` callback (v6.4.0) - Render metrics
- `backgroundColor` support on `Box` (v6.1.0)
- Screen reader/ARIA support (v6.2.0)
- Better terminal resize handling (v6.5.1)

### Files Requiring Updates

#### Package Dependencies
| File | Current | Target | Notes |
|------|---------|--------|-------|
| `packages/cli/package.json` | `"ink": "^4.0.0"` | `"ink": "^6.6.0"` | Main dependency |
| `packages/cli/package.json` | `"react": "^18.2.0"` | `"react": "^19.0.0"` | Required by Ink 6 |
| `packages/cli/package.json` | `"@types/react": "^18.2.0"` | `"@types/react": "^19.0.0"` | TypeScript types |
| `package.json` (root) | `"ink-testing-library": "^4.0.0"` | Check compatibility | Test library |

#### Documentation Updates
| File | Section | Change |
|------|---------|--------|
| `.dev/stages/stage-01-foundation.md` | Line 173 | Update `"ink": "^4.x"` → `"ink": "^6.x"` |
| `docs/architecture.md` | Line 404 | Verify/update Ink reference |

### Ink API Usage in Project (Compatibility Check)

**Hooks used:**
- `useStdout` - ✅ Unchanged in v6
- `useInput` - ✅ Unchanged (added `home`/`end` key support)

**Components used:**
- `Box` - ✅ Compatible (new `backgroundColor` prop added)
- `Text` - ✅ Unchanged
- `render` - ✅ Compatible (new options added: `incrementalRendering`, `maxFps`, `onRender`)

**Test Library:**
- `ink-testing-library` v4.0.0 - ⚠️ Check if compatible with Ink 6.x

### Files Using Ink (39+ files)

**Main CLI:**
- `packages/cli/src/cli.tsx` - `render`, `Text`
- `packages/cli/src/ui/App.tsx` - `Box`, `Text`, `useStdout`

**UI Components:**
- `packages/cli/src/ui/components/chat/ChatHistory.tsx`
- `packages/cli/src/ui/components/chat/StreamingIndicator.tsx`
- `packages/cli/src/ui/components/layout/StatusBar.tsx`
- `packages/cli/src/ui/components/layout/TabBar.tsx`
- `packages/cli/src/ui/components/tools/DiffViewer.tsx`
- `packages/cli/src/ui/components/tools/ReviewActions.tsx`
- `packages/cli/src/ui/components/docs/DocViewer.tsx`
- `packages/cli/src/ui/components/docs/DocNav.tsx`

**Hooks:**
- `packages/cli/src/ui/hooks/useKeyboardShortcuts.ts` - `useInput`

**Animation:**
- `packages/cli/src/components/LlamaAnimation.tsx` - `Box`, `Text`, `useStdout`
- `packages/cli/src/components/lama/LlamaAnimation.tsx` - `Box`, `Text`, `useStdout`

**Tests (20+ files):**
- All `__tests__/*.test.tsx` files use `ink-testing-library`

---

## Upgrade Procedure

### Step 1: Update Dependencies
```bash
# In packages/cli directory
cd packages/cli
npm install ink@^6.6.0 react@^19.0.0
npm install -D @types/react@^19.0.0

# In root directory (for testing library)
cd ../..
npm install -D ink-testing-library@latest
```

### Step 2: Update cli.tsx to Enable Anti-Flicker
```tsx
// packages/cli/src/cli.tsx line 315
render(<App config={config} />, { 
  incrementalRendering: true, 
  maxFps: 20  // Lower than default 30 to reduce CPU usage
});
```

### Step 3: Update Documentation
- `.dev/stages/stage-01-foundation.md` - Update version reference
- Add migration note to changelog

### Step 4: Test Thoroughly
1. Run all tests: `npm run test`
2. Build: `npm run build`
3. Manual test animation: `npx tsx packages/cli/src/components/lama/demo.tsx`
4. Test full CLI: `npm run start`

---

## Recommended Next Steps
1. **Try Option A first** - Upgrade Ink to 6.x and enable `incrementalRendering`
2. **If that fails**, implement Option B as a fallback
3. **Document terminal requirements** for users if advanced protocols are needed