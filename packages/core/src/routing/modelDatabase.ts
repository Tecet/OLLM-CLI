/**
 * Model Database - Registry of known model capabilities, context limits, and characteristics
 */

// Export singleton instance
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir, tmpdir } from 'os';

// @ts-expect-error - picomatch doesn't have type definitions
import picomatch from 'picomatch';

export interface ModelCapabilities {
  toolCalling: boolean;
  vision: boolean;
  streaming: boolean;
  reasoning?: boolean;
}

export interface ModelEntry {
  pattern: string; // Glob pattern (e.g., "llama3.1:*")
  family: string; // Model family
  contextWindow: number; // Max context tokens
  maxOutputTokens?: number; // Max generation tokens
  capabilities: ModelCapabilities;
  profiles: string[]; // Suitable routing profiles
}

/**
 * Default values for unknown models
 */
const DEFAULT_MODEL_ENTRY: Omit<ModelEntry, 'pattern' | 'family'> = {
  contextWindow: 4096,
  capabilities: {
    toolCalling: false,
    vision: false,
    streaming: true,
    reasoning: false,
  },
  profiles: ['general'],
};

/**
 * Model database fallback: keep empty list here so JSON profiles are authoritative.
 * The single-source-of-truth is `packages/cli/src/config/LLM_profiles.json`.
 */
const MODEL_DATABASE: ModelEntry[] = [];
const LLM_MODELS_FILENAME = 'LLM_models.json';
const VITEST_OLLM_PREFIX = 'ollm-vitest';

interface LLMModelsStore {
  models?: Array<Record<string, unknown>>;
  user_models?: Array<Record<string, unknown>>;
}

export class ModelDatabase {
  private entries: ModelEntry[];
  private matchers: Map<string, ReturnType<typeof picomatch>>;

  constructor(entries: ModelEntry[] = MODEL_DATABASE) {
    this.entries = entries;
    this.matchers = new Map();

    // Pre-compile glob patterns for performance
    for (const entry of entries) {
      this.matchers.set(entry.pattern, picomatch(entry.pattern));
    }
  }

  /**
   * Look up a model by name, returning its entry or null if not found
   */
  lookup(modelName: string): ModelEntry | null {
    for (const entry of this.entries) {
      const matcher = this.matchers.get(entry.pattern);
      if (matcher && matcher(modelName)) {
        return entry;
      }
    }
    return null;
  }

  /**
   * Get context window size for a model, with safe default
   */
  getContextWindow(modelName: string): number {
    const entry = this.lookup(modelName);
    if (!entry) return DEFAULT_MODEL_ENTRY.contextWindow;
    // Prefer raw profile value if available
    try {
      const idBase = entry.pattern.endsWith('*') ? entry.pattern.slice(0, -1) : entry.pattern;
      const raw = (RAW_PROFILES && RAW_PROFILES[idBase]) || null;
      if (raw && typeof raw.max_context_window === 'number') return Number(raw.max_context_window);
    } catch (_e) { void _e; }
    return entry.contextWindow ?? DEFAULT_MODEL_ENTRY.contextWindow;
  }

  /**
   * Get capabilities for a model, with safe defaults
   */
  getCapabilities(modelName: string): ModelCapabilities {
    const entry = this.lookup(modelName);
    if (!entry) return DEFAULT_MODEL_ENTRY.capabilities;
    try {
      const idBase = entry.pattern.endsWith('*') ? entry.pattern.slice(0, -1) : entry.pattern;
      const raw = (RAW_PROFILES && RAW_PROFILES[idBase]) || null;
      if (raw) {
        const caps = raw.capabilities ?? {
          toolCalling: Boolean(raw.tool_support),
          vision: (Array.isArray(raw.abilities) && raw.abilities.some((a: string) => /visual|vision|multimodal/i.test(a))) || false,
          streaming: raw.streaming ?? true,
          reasoning: Boolean(raw.thinking_enabled) || (Array.isArray(raw.abilities) && raw.abilities.some((a: string) => /reasoning|think/i.test(a)))
        };
        return {
          toolCalling: Boolean(caps.toolCalling),
          vision: Boolean(caps.vision),
          streaming: Boolean(caps.streaming),
          reasoning: Boolean(caps.reasoning)
        };
      }
    } catch (_e) { void _e; }
    return entry.capabilities ?? DEFAULT_MODEL_ENTRY.capabilities;
  }

  /**
   * Get suitable routing profiles for a model
   */
  getSuitableProfiles(modelName: string): string[] {
    const entry = this.lookup(modelName);
    if (!entry) return DEFAULT_MODEL_ENTRY.profiles;
    try {
      const idBase = entry.pattern.endsWith('*') ? entry.pattern.slice(0, -1) : entry.pattern;
      const raw = (RAW_PROFILES && RAW_PROFILES[idBase]) || null;
      if (raw && Array.isArray(raw.context_profiles)) {
        return raw.context_profiles.map((c: any) => String(c.size_label ?? c.size));
      }
    } catch (_e) { void _e; }
    return entry.profiles ?? DEFAULT_MODEL_ENTRY.profiles;
  }

  /**
   * List all known model entries
   */
  listKnownModels(): ModelEntry[] {
    return [...this.entries];
  }

  /**
   * Get the model family for a model name
   */
  getFamily(modelName: string): string | null {
    const entry = this.lookup(modelName);
    if (!entry) return null;
    try {
      const idBase = entry.pattern.endsWith('*') ? entry.pattern.slice(0, -1) : entry.pattern;
      const raw = (RAW_PROFILES && RAW_PROFILES[idBase]) || null;
      if (raw && raw.family) return String(raw.family);
    } catch (_e) { void _e; }
    return entry.family ?? null;
  }
}

function tryLoadProfilesFromCli(): ModelEntry[] | null {
  try {
    const p = join(process.cwd(), 'packages', 'cli', 'src', 'config', 'LLM_profiles.json');
    if (!existsSync(p)) return null;
    const raw = readFileSync(p, 'utf-8');
    const json = JSON.parse(raw) as { models?: Array<any> };
    if (!Array.isArray(json.models)) return null;

    const entries: ModelEntry[] = json.models.map(m => {
      const id: string = m.id || m.name || 'unknown';
      // Treat each model as its own family (no grouping)
      const family = String(id);
      const contextWindow = Number(m.max_context_window ?? (Array.isArray(m.context_profiles) ? Math.max(...m.context_profiles.map((c: any) => Number(c.size || 0))) : 4096)) || 4096;
      const caps = m.capabilities ?? {
        toolCalling: Boolean(m.tool_support),
        vision: (Array.isArray(m.abilities) && m.abilities.some((a: string) => /visual|vision|multimodal/i.test(a))) || false,
        streaming: true,
        reasoning: Boolean(m.thinking_enabled) || (Array.isArray(m.abilities) && m.abilities.some((a: string) => /reasoning|think/i.test(a)))
      };

      const profiles = Array.isArray(m.context_profiles) ? m.context_profiles.map((c: any) => String(c.size_label ?? c.size)) : ['general'];

      return {
        // Use exact model id as the routing pattern to avoid family-based grouping
        pattern: `${id}`,
        family: family,
        contextWindow,
        capabilities: {
          toolCalling: Boolean(caps.toolCalling),
          vision: Boolean(caps.vision),
          streaming: Boolean(caps.streaming),
          reasoning: Boolean(caps.reasoning)
        },
        profiles: profiles
      } as ModelEntry;
    });

    return entries;
  } catch (_e) { void _e; return null; }
}

// Load raw profiles map (id -> profile object) for direct sourcing of fields
function tryLoadRawProfiles(): Record<string, any> | null {
  try {
    const p = join(process.cwd(), 'packages', 'cli', 'src', 'config', 'LLM_profiles.json');
    if (!existsSync(p)) return null;
    const raw = readFileSync(p, 'utf-8');
    const json = JSON.parse(raw) as { models?: Array<any> };
    if (!Array.isArray(json.models)) return null;
    const map: Record<string, any> = {};
    for (const m of json.models) {
      const id = m.id || m.name || String(m.name || 'unknown');
      map[String(id)] = m;
    }
    return map;
  } catch (_e) { void _e; return null; }
}

function getRuntimeLLMModelsPath(): string {
  const base = process.env.VITEST
    ? join(tmpdir(), `${VITEST_OLLM_PREFIX}-${process.pid}`)
    : homedir();
  return join(base, '.ollm', LLM_MODELS_FILENAME);
}

function buildModelEntryFromProfile(profile: Record<string, any>): ModelEntry {
  const id = String(profile.id || profile.name || 'unknown');
  const contextProfiles: Array<Record<string, unknown>> = Array.isArray(profile.context_profiles)
    ? profile.context_profiles
    : [];
  const maxContextWindow = Number(
    profile.max_context_window ??
    profile.context_window ??
    (contextProfiles.length > 0
      ? Math.max(...contextProfiles.map(cp => Number((cp as Record<string, any>).size ?? 0)))
      : 0)
  ) || 4096;

  const capabilitiesSource = profile.capabilities ?? {
    toolCalling: Boolean(profile.tool_support),
    vision: (Array.isArray(profile.abilities) && profile.abilities.some((a: string) => /visual|vision|multimodal/i.test(a))) || false,
    streaming: profile.streaming ?? true,
    reasoning: Boolean(profile.thinking_enabled) || (Array.isArray(profile.abilities) && profile.abilities.some((a: string) => /reasoning|think/i.test(a))),
  };

  const profiles = contextProfiles.length > 0
    ? contextProfiles.map(cp => String((cp as Record<string, unknown>).size_label ?? (cp as Record<string, unknown>).size ?? 'general'))
    : ['general'];

  return {
    pattern: id,
    family: id,
    contextWindow: maxContextWindow,
    capabilities: {
      toolCalling: Boolean(capabilitiesSource.toolCalling),
      vision: Boolean(capabilitiesSource.vision),
      streaming: Boolean(capabilitiesSource.streaming),
      reasoning: Boolean(capabilitiesSource.reasoning),
    },
    profiles,
  };
}

function tryLoadRuntimeLLMModels(): { entries: ModelEntry[]; raw: Record<string, any> } | null {
  try {
    const path = getRuntimeLLMModelsPath();
    if (!existsSync(path)) return null;
    const content = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(content) as LLMModelsStore;
    if (!Array.isArray(parsed.models) || parsed.models.length === 0) return null;

    const entries: ModelEntry[] = [];
    const rawMap: Record<string, any> = {};

    for (const model of parsed.models) {
      const entry = buildModelEntryFromProfile(model);
      entries.push(entry);
      const key = String(model.id || model.name || entry.pattern || 'unknown');
      rawMap[key] = model;
    }

    return { entries, raw: rawMap };
  } catch (_error) {
    return null;
  }
}

// Prefer a generated TypeScript DB if present (faster startup, no runtime JSON parsing)
const runtimeStore = tryLoadRuntimeLLMModels();
const runtimeEntries = runtimeStore?.entries ?? null;
const runtimeRawProfiles = runtimeStore?.raw ?? null;

let GENERATED_ENTRIES: ModelEntry[] | null = null;
let GENERATED_RAW_PROFILES: Record<string, any> | null = null;
try {
  // Attempt to require a generated module in the same directory
  // The generated file `generated_model_db.ts` will compile to JS next to this file in the build output.
  // Use require to avoid static import errors when the generated file is absent.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const gen = require('./generated_model_db');
  if (gen && Array.isArray(gen.GENERATED_MODEL_DB)) {
    GENERATED_ENTRIES = gen.GENERATED_MODEL_DB as any;
    // Use generated raw profiles map if provided, otherwise build a simple map
    if (gen.GENERATED_RAW_PROFILES) {
      GENERATED_RAW_PROFILES = gen.GENERATED_RAW_PROFILES as any;
    } else {
      GENERATED_RAW_PROFILES = {};
      for (const m of (GENERATED_ENTRIES ?? [])) {
        const id = (m.pattern || '').endsWith('*')
          ? (m.pattern || '').slice(0, -1)
          : (m.pattern || '');
        GENERATED_RAW_PROFILES[id] = m as any;
      }
    }
  }
} catch (_e) { void _e; }

const FALLBACK_ENTRIES = runtimeEntries ?? GENERATED_ENTRIES ?? tryLoadProfilesFromCli() ?? MODEL_DATABASE;
const RAW_PROFILES = runtimeRawProfiles ?? GENERATED_RAW_PROFILES ?? tryLoadRawProfiles();

// Export a ModelDatabase that prefers runtime overrides, then generated profiles, otherwise fallback data
export const modelDatabase = new ModelDatabase(FALLBACK_ENTRIES);

// Attach raw profiles map for external inspection (if needed)
(modelDatabase as any)._rawProfiles = RAW_PROFILES ?? {};
