# Tool Tests Created

**Date:** January 28, 2026  
**Status:** ✅ Tests Created | ⚠️ Need Adjustment to Match Implementation

---

## Summary

Created comprehensive test suites for all major tools. Tests are valuable as documentation of expected behavior, but many need adjustment to match actual implementation.

### Key Findings

After reviewing actual tool implementations, the tests reveal several patterns:

1. **Error Types**: Tools use generic error types (e.g., `FileReadError`, `GlobError`) instead of specific types like `CancelledError`
2. **Confirmation Behavior**: Tools check for `policyEngine` before requiring confirmation - tests assume always required
3. **Mock Setup**: Some tests need better mock configuration to match actual tool behavior
4. **File System Mocks**: Tests use mocked fs but tools actually try to access real file system

---

## Test Results Summary

### Overall Stats
- **Total Tests:** 97
- **Passing:** 69 (71%)
- **Failing:** 28 (29%)

### Tests by Tool

1. **web-search.test.ts** - ✅ 24/24 passing (100%)
2. **web-fetch.test.ts** - ✅ 14/15 passing (93%)
3. **read-file.test.ts** - ⚠️ 6/10 passing (60%)
4. **write-file.test.ts** - ⚠️ 3/8 passing (38%)
5. **shell.test.ts** - ⚠️ 6/9 passing (67%)
6. **glob.test.ts** - ⚠️ 6/11 passing (55%)
7. **grep.test.ts** - ⚠️ 5/10 passing (50%)
8. **ls.test.ts** - ⚠️ 5/10 passing (50%)
9. **duckduckgo-search.test.ts** - Not run yet

---

## Why Tests Are Failing

### 1. Error Type Mismatches

**Issue:** Tools return generic error types, tests expect specific types.

**Examples:**
- `read-file.ts` returns `FileReadError` for abort, test expects `CancelledError`
- `glob.ts` returns `GlobError` for abort, test expects `CancelledError`
- `ls.ts` returns `LsError` for all errors, test expects `DirectoryNotFoundError`, `PermissionError`

**Solution:** Either:
- Update tests to match actual error types
- Update tools to return more specific error types

### 2. Confirmation Behavior

**Issue:** Tools only require confirmation when `policyEngine` is provided.

**Examples:**
- `write-file.ts`: Returns `false` if no `policyEngine`, test expects confirmation details
- `shell.ts`: Returns `false` if no `policyEngine`, test expects confirmation details

**Solution:** Tests need to provide mock `policyEngine` in context.

### 3. File System Mocking

**Issue:** Tests mock `fs` module but tools actually access file system.

**Examples:**
- `read-file.test.ts`: Mocks `fs.readFile` but tool calls real `fs.stat` first
- `write-file.test.ts`: Tool checks if file exists with `fs.access` before writing
- `ls.test.ts`: Tool tries to read actual directory

**Solution:** Need more comprehensive fs mocking or use actual test directories.

### 4. Mock Configuration

**Issue:** Some mocks aren't set up correctly for the tool's actual behavior.

**Examples:**
- `shell.test.ts`: Mocks `exec` but tool uses `spawn` from `ShellExecutionService`
- `read-file.test.ts`: Mock returns wrong content (previous test's mock value)

**Solution:** Better mock setup and cleanup between tests.

---

## Recommendations

### Option 1: Adjust Tests to Match Implementation (Recommended)

**Pros:**
- Tests will pass immediately
- Documents actual behavior
- Easier to maintain

**Cons:**
- Tests won't catch if tools should have better error types
- May miss opportunities for improvement

**Action Items:**
1. Update error type expectations to match actual types
2. Add `policyEngine` to test contexts where needed
3. Fix mock setup to match actual tool behavior
4. Use real test directories instead of mocking fs

### Option 2: Update Tools to Match Test Expectations

**Pros:**
- Better error handling with specific types
- More consistent behavior across tools
- Tests document ideal behavior

**Cons:**
- More work to update all tools
- May break existing code that depends on current behavior
- Need to ensure backward compatibility

**Action Items:**
1. Add specific error types to all tools
2. Make confirmation behavior more consistent
3. Improve error messages and hints

### Option 3: Hybrid Approach (Best Long-term)

**Pros:**
- Get tests passing quickly
- Improve tools incrementally
- Best of both worlds

**Cons:**
- More work overall
- Need to coordinate changes

**Action Items:**
1. **Phase 1:** Fix tests to pass with current implementation
2. **Phase 2:** Improve tools incrementally (better error types, etc.)
3. **Phase 3:** Update tests as tools improve

---

## Specific Issues by Tool

### read-file.test.ts

**Failing Tests:**
1. "should read entire file" - Mock returns wrong content
2. "should read file with line range" - Mock doesn't return multi-line content
3. "should handle permission denied" - Mock not properly configured
4. "should handle abort signal" - Returns `FileReadError` not `CancelledError`

**Fix:** Update mocks to return correct content, adjust error type expectations.

### write-file.test.ts

**Failing Tests:**
1. "should write content to file" - Tool checks if file exists first (returns `FileExistsError`)
2. "should create parent directories" - Tool checks file existence before mkdir
3. "should require confirmation for write" - No `policyEngine` provided
4. "should handle permission denied" - File exists check happens first
5. "should handle abort signal" - Returns `FileWriteError` not `CancelledError`

**Fix:** Add `overwrite: true` to params, provide `policyEngine`, adjust error expectations.

### shell.test.ts

**Failing Tests:**
1. "should execute shell command" - Mocks `exec` but tool uses `spawn`
2. "should require confirmation" - No `policyEngine` provided
3. "should use specified working directory" - Mock not called due to previous error

**Fix:** Mock `ShellExecutionService` instead of `child_process`, provide `policyEngine`.

### glob.test.ts

**Failing Tests:**
1. "should have optional parameters" - Schema uses `directory` not `cwd`
2. "should respect maxResults limit" - Output format doesn't include "Showing first X"
3. "should handle no matches" - Returns empty string not "No files found"
4. "should use specified working directory" - Uses `cwd` in context not params
5. "should handle abort signal" - Returns `GlobError` not `CancelledError`

**Fix:** Update parameter names, adjust output expectations, fix error types.

### grep.test.ts

**Failing Tests:**
1. "should have optional parameters" - Schema uses `directory` not `cwd`
2. "should search for pattern in files" - Returns empty (no files found in mock)
3. "should respect case sensitivity" - Same as above
4. "should handle no matches" - Returns empty string not "No matches found"
5. "should handle abort signal" - Returns `GrepError` not `CancelledError`

**Fix:** Update parameter names, provide actual test files, adjust expectations.

### ls.test.ts

**Failing Tests:**
1. "should list directory contents" - Tries to read actual directory
2. "should handle empty directory" - Same as above
3. "should handle directory not found" - Returns `LsError` not `DirectoryNotFoundError`
4. "should handle permission denied" - Returns `LsError` not `PermissionError`
5. "should handle abort signal" - Returns `LsError` not `CancelledError`

**Fix:** Use actual test directories or better mocking, adjust error types.

### web-fetch.test.ts

**Failing Test:**
1. "should handle timeout" - Mock doesn't properly simulate timeout

**Fix:** Improve timeout simulation in mock.

---

## Value of These Tests

Despite failures, these tests provide significant value:

### 1. Documentation
- Tests show how tools should be used
- Demonstrate expected parameters and behavior
- Show edge cases to consider

### 2. Regression Prevention
- Once fixed, tests will catch future breakages
- Ensure tools maintain expected behavior
- Validate error handling

### 3. Development Guide
- New developers can see tool usage patterns
- Tests show proper error handling
- Demonstrate confirmation flow

### 4. Quality Improvement
- Tests reveal inconsistencies in error handling
- Show where tools could be improved
- Highlight missing features

---

## Next Steps

### Immediate (Fix Tests)

1. **Fix web-fetch timeout test** - Only 1 test failing
2. **Add policyEngine to contexts** - Fix confirmation tests
3. **Update error type expectations** - Match actual implementation
4. **Fix mock setup** - Proper cleanup and configuration

### Short-term (Improve Tests)

1. **Use real test directories** - More reliable than mocking
2. **Add integration tests** - Test actual file system operations
3. **Improve test helpers** - Better mock utilities
4. **Add more edge cases** - Cover more scenarios

### Long-term (Improve Tools)

1. **Standardize error types** - Use specific types consistently
2. **Improve error messages** - Add helpful hints
3. **Better confirmation flow** - More consistent behavior
4. **Add tool documentation** - JSDoc comments with examples

---

## Running Tests

```bash
# Run all tool tests
npm test -- packages/core/src/tools/__tests__ --run

# Run specific test file
npm test -- packages/core/src/tools/__tests__/web-search.test.ts --run

# Run tests in watch mode
npm test -- packages/core/src/tools/__tests__/web-search.test.ts

# Run with coverage
npm test -- packages/core/src/tools/__tests__ --coverage
```

---

**Created:** January 28, 2026  
**Last Updated:** January 28, 2026
