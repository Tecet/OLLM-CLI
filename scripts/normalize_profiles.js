import fs from 'fs/promises';
import path from 'path';

const profilesPath = path.join(
  process.cwd(),
  'packages',
  'cli',
  'src',
  'config',
  'LLM_profiles.json'
);

function parseVramEstimate(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return null;
  const gb = v.match(/([0-9]+(?:\.[0-9]+)?)\s*GB/i);
  if (gb) return Number(gb[1]);
  const mb = v.match(/([0-9]+(?:\.[0-9]+)?)\s*MB/i);
  if (mb) return Number(mb[1]) / 1024;
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');

  const raw = await fs.readFile(profilesPath, 'utf-8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.models)) {
    console.error('Unexpected profiles format: missing models array');
    process.exitCode = 2;
    return;
  }

  let changed = false;
  for (const m of data.models) {
    if (m.context_window && m.max_context_window == null) {
      m.max_context_window = m.context_window;
      delete m.context_window;
      changed = true;
    }

    if (!Array.isArray(m.context_profiles)) m.context_profiles = [];
    for (const cp of m.context_profiles) {
      if (cp.vram_estimate_gb == null) {
        const parsed = parseVramEstimate(cp.vram_estimate ?? cp.vram);
        if (typeof parsed === 'number') {
          cp.vram_estimate_gb = parsed;
          changed = true;
        }
      }
    }
  }

  if (!changed) {
    console.log('No normalization changes needed');
    return;
  }

  console.log(`Normalization detected changes; ${apply ? 'applying' : 'dry-run only'}`);
  if (apply) {
    await fs.writeFile(profilesPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    console.log('Wrote normalized profiles to', profilesPath);
  } else {
    console.log('Run `node scripts/normalize_profiles.js --apply` to write changes.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
