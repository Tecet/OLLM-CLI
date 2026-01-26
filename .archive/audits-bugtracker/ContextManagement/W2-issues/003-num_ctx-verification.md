Title: Verify `num_ctx` is sent and respected by providers (Ollama)

Severity: Medium

Summary:
The UI/code passes `options.num_ctx` from ModelContext settings to the provider request payload (Ollama local provider), but there is no automated verification that the provider accepted or honored the `num_ctx` parameter. This can lead to mismatch between user-selected context size and actual model inference window.

Files of interest:
- `packages/cli/src/features/context/ModelContext.tsx` (passes `options: { num_ctx: contextSize }`)
- `packages/ollm-bridge/src/provider/localProvider.ts` (includes `options` in payload to Ollama API)

Reproduction steps / tests to add (suggested):
- Add a test that stubs/fakes fetch in `LocalProvider` to assert `options.num_ctx` is present in the request payload when `ModelContext` triggers a call.
- Add an integration test against a local Ollama stub to assert the server saw `num_ctx` and reacted accordingly.

Impact:
- Users may select a context size that is not applied to the model, leading to unexpected truncation or OOM behavior.

Suggested fixes:
1. Add unit test to assert `num_ctx` present in outgoing payloads.
2. Add integration test or health check verifying provider acceptance or log messages if ignored.

Priority: Medium — ensures correctness of user-visible settings.
