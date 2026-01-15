# Ollama Models Reference for OLLM CLI

## Overview

This document provides a comprehensive reference for Ollama-compatible models, focusing on context management, tool calling capabilities, and VRAM requirements - critical factors for the OLLM CLI context management system.

## Context Window Fundamentals

### Ollama Default Behavior
- **Default context window**: 2048 tokens (conservative default)
- **Configurable via**: `num_ctx` parameter in Modelfile or API request
- **Environment variable**: `OLLAMA_CONTEXT_LENGTH`

### Context Window vs num_ctx
- **Context window**: Maximum tokens a model architecture supports
- **num_ctx**: Ollama-specific parameter setting active context length for inference
- Models can support larger contexts than Ollama's default - must be explicitly configured

## VRAM Requirements

### Memory Calculation Formula
```
Total VRAM = Model Weights + KV Cache + System Overhead (~0.5-1GB)
```

### Base VRAM by Model Size (Q4_K_M Quantization)

| Model Size | Est. File Size | Recommended VRAM | Example Models |
|------------|----------------|------------------|----------------|
| 3B-4B | 2.0-2.5 GB | 3-4 GB | Llama 3.2 3B, Qwen3 4B |
| 7B-9B | 4.5-6.0 GB | 6-8 GB | Llama 3.1 8B, Qwen3 8B, Mistral 7B |
| 12B-14B | 7.5-9.0 GB | 10-12 GB | Gemma 3 12B, Qwen3 14B, Phi-4 14B |
| 22B-35B | 14-21 GB | 16-24 GB | Gemma 3 27B, Qwen3 32B, DeepSeek R1 32B |
| 70B-72B | 40-43 GB | 48 GB (or 2×24GB) | Llama 3.3 70B, Qwen2.5 72B |

### KV Cache Memory Impact
KV cache grows linearly with context length:
- **8B model at 32K context**: ~4.5 GB for KV cache alone
- **Q8_0 KV quantization**: Halves KV cache memory (minimal quality impact)
- **Q4_0 KV quantization**: Reduces to 1/3 (noticeable quality reduction)

### Context Length VRAM Examples (8B Model, Q4_K_M)
| Context Length | KV Cache (FP16) | KV Cache (Q8_0) | Total VRAM |
|----------------|-----------------|-----------------|------------|
| 4K tokens | ~0.6 GB | ~0.3 GB | ~6-7 GB |
| 8K tokens | ~1.1 GB | ~0.55 GB | ~7-8 GB |
| 16K tokens | ~2.2 GB | ~1.1 GB | ~8-9 GB |
| 32K tokens | ~4.5 GB | ~2.25 GB | ~10-11 GB |

## Popular Models for Tool Calling

### Tier 1: Best Tool Calling Support

#### Llama 3.1/3.3 (8B, 70B)
- **Context**: 128K tokens (native)
- **Tool calling**: Native function calling support
- **VRAM**: 8GB (8B), 48GB+ (70B)
- **Strengths**: Best overall, largest ecosystem, excellent instruction following
- **Downloads**: 108M+ (most popular)

#### Qwen3 (4B-235B)
- **Context**: Up to 256K tokens
- **Tool calling**: Native support with hybrid reasoning modes
- **VRAM**: 4GB (4B) to 48GB+ (32B)
- **Strengths**: Multilingual, thinking/non-thinking modes, Apache 2.0 license
- **Special**: Can set "thinking budget" for reasoning depth

#### Mistral 7B / Mixtral 8x7B
- **Context**: 32K tokens (Mistral), 64K tokens (Mixtral)
- **Tool calling**: Native function calling
- **VRAM**: 7GB (7B), 26GB (8x7B MoE - only 13B active)
- **Strengths**: Efficient, excellent European languages

### Tier 2: Good Tool Calling Support

#### DeepSeek-R1 (1.5B-671B)
- **Context**: 128K tokens
- **Tool calling**: Supported via reasoning
- **VRAM**: 4GB (1.5B) to enterprise (671B)
- **Strengths**: Advanced reasoning, matches o1 on benchmarks
- **Architecture**: Mixture of Experts (MoE)

#### Gemma 3 (4B-27B)
- **Context**: 128K tokens (4B+)
- **Tool calling**: Supported
- **VRAM**: 4GB (4B) to 24GB (27B)
- **Strengths**: Multimodal (vision), efficient architecture

#### Phi-4 (14B)
- **Context**: 16K tokens
- **Tool calling**: Supported
- **VRAM**: 12GB
- **Strengths**: Exceptional reasoning for size, synthetic data training

### Tier 3: ReAct Fallback Required

#### CodeLlama (7B-70B)
- **Context**: 16K tokens (2K for 70B)
- **Tool calling**: Via ReAct loop
- **VRAM**: 4GB (7B) to 40GB (70B)
- **Best for**: Code-specific tasks

#### Llama 2 (7B-70B)
- **Context**: 4K tokens
- **Tool calling**: Via ReAct loop
- **VRAM**: 4GB (7B) to 40GB (70B)
- **Note**: Legacy, prefer Llama 3.x

## Model Selection Matrix

### By VRAM Available

| VRAM | Recommended Models | Context Sweet Spot |
|------|-------------------|-------------------|
| 4GB | Llama 3.2 3B, Qwen3 4B, Phi-3 Mini | 4K-8K |
| 8GB | Llama 3.1 8B, Qwen3 8B, Mistral 7B | 8K-16K |
| 12GB | Gemma 3 12B, Qwen3 14B, Phi-4 14B | 16K-32K |
| 16GB | Qwen3 14B (high ctx), DeepSeek R1 14B | 32K-64K |
| 24GB | Gemma 3 27B, Qwen3 32B, Mixtral 8x7B | 32K-64K |
| 48GB+ | Llama 3.3 70B, Qwen2.5 72B | 64K-128K |

### By Use Case

| Use Case | Recommended Model | Why |
|----------|------------------|-----|
| General coding | Qwen2.5-Coder 7B/32B | Best open-source coding model |
| Tool calling | Llama 3.1 8B | Native support, well-tested |
| Long context | Qwen3 8B/14B | Up to 256K context |
| Reasoning | DeepSeek-R1 14B/32B | Matches frontier models |
| Low VRAM | Llama 3.2 3B | Excellent for 4GB |
| Multilingual | Qwen3 series | 29+ languages |

## Quantization Guide

### Recommended Quantization Levels

| Level | VRAM Savings | Quality Impact | Recommendation |
|-------|--------------|----------------|----------------|
| Q8_0 | ~50% | Minimal | Best quality |
| Q6_K | ~60% | Very slight | High quality |
| Q5_K_M | ~65% | Slight | Good balance |
| **Q4_K_M** | ~75% | Minor | **Sweet spot** |
| Q4_0 | ~75% | Noticeable | Budget option |
| Q3_K_M | ~80% | Significant | Not recommended |
| Q2_K | ~85% | Severe | Avoid |

### KV Cache Quantization
```bash
# Enable Q8_0 KV cache (recommended)
export OLLAMA_KV_CACHE_TYPE=q8_0

# Enable Q4_0 KV cache (aggressive)
export OLLAMA_KV_CACHE_TYPE=q4_0
```

**Note**: KV cache quantization requires Flash Attention enabled.

## Ollama Configuration

### Setting Context Length

#### Via Modelfile
```dockerfile
FROM llama3.1:8b
PARAMETER num_ctx 32768
```

#### Via API Request
```json
{
  "model": "llama3.1:8b",
  "options": {
    "num_ctx": 32768
  }
}
```

#### Via Environment
```bash
export OLLAMA_CONTEXT_LENGTH=32768
```

### Performance Optimization
```bash
# Enable Flash Attention
export OLLAMA_FLASH_ATTENTION=1

# Set KV cache quantization
export OLLAMA_KV_CACHE_TYPE=q8_0

# Keep model loaded
export OLLAMA_KEEP_ALIVE=24h
```

## MCP and Tool Integration

### Models with Native Tool Calling
These models support Ollama's native function calling format:
- Llama 3.1/3.2/3.3 series
- Qwen3 series
- Mistral/Mixtral series
- Gemma 3 series

### ReAct Fallback
For models without native tool calling, OLLM CLI uses ReAct prompting:
```
Thought: [reasoning about the task]
Action: [tool_name]
Action Input: {"param": "value"}
Observation: [tool result]
Final Answer: [response]
```

## Performance Benchmarks

### Inference Speed (tokens/second)

| Model | Full VRAM | Partial Offload | CPU Only |
|-------|-----------|-----------------|----------|
| Llama 3.1 8B | 40-70 t/s | 8-15 t/s | 3-6 t/s |
| Qwen3 8B | 35-60 t/s | 7-12 t/s | 2-5 t/s |
| Mistral 7B | 45-80 t/s | 10-18 t/s | 4-7 t/s |

**Key insight**: Partial VRAM offload causes 5-20x slowdown. Always aim to fit model entirely in VRAM.

## References

- [Ollama Documentation](https://docs.ollama.com/)
- [Ollama Model Library](https://ollama.com/library)
- [llama.cpp](https://github.com/ggerganov/llama.cpp)
- Content was rephrased for compliance with licensing restrictions
