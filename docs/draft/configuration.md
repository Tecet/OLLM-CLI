# Configuration Plan

## Sources and Precedence
1. System defaults
2. User settings
3. Workspace settings
4. Environment variables
5. CLI flags

## Settings Schema (Proposal)
- provider: string (default ollama)
- providerConfig:
  - ollama: { host, timeout, keepAlive }
  - openai_compat: { baseUrl, apiKey }
- model:
  - name
  - options: temperature, num_ctx, num_predict, top_k, top_p, repeat_penalty
- models:
  - autoPull
  - preferredQuantization
- tools:
  - allowed, excluded, core
  - shell settings and confirmation policy
- hooks, extensions, mcp, session, ui, accessibility, sandbox, telemetry

## Example settings (YAML-style)
```yaml
provider: ollama
providerConfig:
  ollama:
    host: http://localhost:11434
    timeout: 300000
    keepAlive: 300
model:
  name: llama3:8b
  options:
    temperature: 0.2
    num_ctx: 8192
    num_predict: 1024
models:
  autoPull: true
  preferredQuantization: q4_0
```

## Environment Variables
- OLLM_PROVIDER
- OLLM_HOST
- OLLM_MODEL
- OLLM_TIMEOUT
- OLLM_KEEP_ALIVE
- OLLM_MODELS_DIR

## CLI Flags Mapping
- --provider, --host, --model
- --temperature, --num-ctx, --num-predict
- --list-models, --pull-model, --remove-model

## Migration Rules
- Map legacy settings keys to the new schema.
- Provide automatic migration on first run with a backup.
