# Fix 3.3: Relax Tool Schema Validation - COMPLETE

**Date:** January 19, 2026  
**Status:** ✅ Complete  
**Priority:** P2 - MEDIUM

---

## Summary

Successfully relaxed tool schema validation to accept namespaced tool names with dots and slashes. This enables MCP servers, extensions, and external tools to use standard naming conventions like `mcp.search`, `github/issues`, or `ext.code-analysis.lint`.

---

## Problem

### Before Fix
Tool name validation was too strict, rejecting common namespacing patterns:

```typescript
// Only allowed: letters, numbers, underscores, dashes
if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(tool.name)) {
  throw new Error(`Tool name "${tool.name}" is invalid...`);
}
```

**Rejected Names:**
- `mcp.search` ❌ (dot not allowed)
- `github/issues` ❌ (slash not allowed)
- `ext.code-analysis.lint` ❌ (dots not allowed)

### Issues Caused
1. **MCP Integration Blocked:** MCP servers use dot notation (`mcp.filesystem.read`)
2. **Extension Tools Rejected:** Extensions use namespaced names (`ext.linter.run`)
3. **GitHub-Style Names Blocked:** Common pattern `org/tool` rejected
4. **Poor Error Messages:** Errors appear during LLM calls, not registration

---

## Solution

### After Fix
Relaxed validation to allow dots (`.`) and slashes (`/`) for namespacing:

```typescript
// Now allows: letters, numbers, underscores, dashes, dots, slashes
if (!/^[a-zA-Z_][a-zA-Z0-9_.\/-]*$/.test(tool.name)) {
  throw new Error(
    `Tool schema validation failed: Tool name "${tool.name}" is invalid. ` +
    'Tool names must start with a letter or underscore and contain only letters, numbers, underscores, dashes, dots, or slashes'
  );
}
```

**Now Accepted:**
- `mcp.search` ✅
- `github/issues` ✅
- `ext.code-analysis.lint` ✅
- `mcp.github/search` ✅ (mixed)

### Benefits
1. **MCP Compatibility:** MCP servers work out of the box
2. **Extension Support:** Extensions can use standard naming
3. **Flexibility:** Supports various namespacing conventions
4. **Backward Compatible:** All previously valid names still work

---

## Implementation Details

### Changes Made
**File:** `packages/ollm-bridge/src/provider/localProvider.ts`

**Method:** `validateToolSchema()`

**Changes:**
1. Updated regex pattern from `/^[a-zA-Z_][a-zA-Z0-9_-]*$/` to `/^[a-zA-Z_][a-zA-Z0-9_.\/-]*$/`
2. Added `.` (dot) and `/` (slash) to allowed characters
3. Updated error message to reflect new rules
4. Added comment explaining relaxed validation

### Validation Rules

#### Still Required
- Must start with letter or underscore
- Cannot be empty or whitespace-only
- Must be a string

#### Now Allowed
- Letters (a-z, A-Z)
- Numbers (0-9)
- Underscores (_)
- Dashes (-)
- **Dots (.) - NEW**
- **Slashes (/) - NEW**

#### Still Rejected
- Starting with number, dash, dot, or slash
- Spaces
- Special characters (@, #, $, %, etc.)

---

## Test Coverage

### Test File
**File:** `packages/ollm-bridge/src/provider/__tests__/toolSchemaValidation.test.ts`

### Test Results
✅ **30 tests, all passing**

### Test Categories

#### 1. Valid Tool Names (4 tests)
- ✅ Simple alphanumeric names
- ✅ Names with underscores
- ✅ Names with dashes
- ✅ Names starting with underscore

#### 2. Namespaced Tool Names - Dots (4 tests)
- ✅ Single dot (e.g., `mcp.search`)
- ✅ Multiple dots (e.g., `mcp.github.search`)
- ✅ Dots with underscores
- ✅ Dots with dashes

#### 3. Namespaced Tool Names - Slashes (4 tests)
- ✅ Single slash (e.g., `github/search`)
- ✅ Multiple slashes (e.g., `github/issues/search`)
- ✅ Slashes with underscores
- ✅ Slashes with dashes

#### 4. Mixed Namespacing (2 tests)
- ✅ Both dots and slashes (e.g., `mcp.github/search`)
- ✅ Complex combinations

#### 5. Invalid Tool Names (8 tests)
- ✅ Starting with number
- ✅ Starting with dash
- ✅ Starting with dot
- ✅ Starting with slash
- ✅ With spaces
- ✅ With special characters
- ✅ Empty names
- ✅ Whitespace-only names

#### 6. Real-World Examples (3 tests)
- ✅ MCP server tools (`mcp.filesystem.read`)
- ✅ GitHub-style tools (`github/issues/list`)
- ✅ Extension tools (`ext.code-analysis.lint`)

#### 7. Edge Cases (5 tests)
- ✅ Very long namespaced names
- ✅ Consecutive dots
- ✅ Consecutive slashes
- ✅ Ending with dot
- ✅ Ending with slash

---

## Examples

### MCP Server Tools
```typescript
// All now valid:
'mcp.filesystem.read'
'mcp.filesystem.write'
'mcp.database.query'
'mcp.http.request'
```

### GitHub-Style Tools
```typescript
// All now valid:
'github/issues/list'
'github/pulls/create'
'github/repos/search'
'github/actions/run'
```

### Extension Tools
```typescript
// All now valid:
'ext.linter.run'
'ext.formatter.format'
'ext.testing.run-tests'
'ext.docs.generate'
```

### Mixed Namespacing
```typescript
// All now valid:
'mcp.github/search'
'ext.code-analysis/lint'
'tools.github.issues/search'
```

---

## Impact Assessment

### Compatibility
- **Backward Compatible:** ✅ All previously valid names still work
- **Breaking Changes:** ❌ None
- **Migration Required:** ❌ No

### Use Cases Enabled
1. **MCP Integration:** MCP servers can register tools with standard names
2. **Extension System:** Extensions can use namespaced tool names
3. **External Tools:** Third-party tools can use their naming conventions
4. **Organization:** Teams can organize tools by namespace

### Performance
- **Memory:** No impact (same validation logic)
- **Speed:** No impact (same regex complexity)
- **Compatibility:** Improved (more tools accepted)

---

## Edge Cases Handled

### 1. Consecutive Separators
**Input:** `mcp..search` or `github//issues`  
**Behavior:** Accepted (validation doesn't enforce single separators)  
**Rationale:** Let tools decide their naming convention

### 2. Trailing Separators
**Input:** `mcp.search.` or `github/issues/`  
**Behavior:** Accepted  
**Rationale:** Doesn't break functionality, tools can clean up

### 3. Mixed Separators
**Input:** `mcp.github/search`  
**Behavior:** Accepted  
**Rationale:** Supports hybrid namespacing schemes

### 4. Very Long Names
**Input:** `mcp.github.issues.search.advanced.filters.apply`  
**Behavior:** Accepted  
**Rationale:** No length limit needed

---

## Future Enhancements

### 1. Namespace Validation
Add optional namespace validation:

```typescript
interface NamespaceRules {
  allowedNamespaces?: string[]; // e.g., ['mcp', 'ext', 'github']
  requireNamespace?: boolean;   // Force namespacing
}
```

### 2. Custom Validation Rules
Allow providers to customize validation:

```typescript
interface LocalProviderOptions {
  toolNameValidation?: {
    pattern?: RegExp;
    customValidator?: (name: string) => boolean;
  };
}
```

### 3. Validation at Registration Time
Move validation earlier in the pipeline:

```typescript
// In ToolRegistry.register()
validateToolSchema(tool); // Fail fast at registration
```

### 4. Deprecation Warnings
Warn about non-standard patterns:

```typescript
if (tool.name.includes('..') || tool.name.includes('//')) {
  logger.warn(`Tool "${tool.name}" uses non-standard naming`);
}
```

---

## Documentation

### Code Comments
- ✅ Added comment explaining relaxed validation
- ✅ Updated error message with new rules
- ✅ Documented allowed characters

### Test Documentation
- ✅ Comprehensive test suite with clear descriptions
- ✅ Real-world examples for each pattern
- ✅ Edge cases documented

### User Documentation
- ⏳ Update tool registration guide
- ⏳ Document naming conventions
- ⏳ Add MCP integration examples

---

## Files Changed

### Modified Files
1. `packages/ollm-bridge/src/provider/localProvider.ts` (~5 lines changed)

### New Files
1. `packages/ollm-bridge/src/provider/__tests__/toolSchemaValidation.test.ts` (new test file)

### Total Changes
- **Lines Added:** ~400 (mostly tests)
- **Lines Modified:** ~5 (implementation)
- **Tests Added:** 30
- **Tests Passing:** 30/30 ✅

---

## Success Criteria

✅ Dots allowed in tool names  
✅ Slashes allowed in tool names  
✅ MCP server tools work  
✅ GitHub-style tools work  
✅ Extension tools work  
✅ Mixed namespacing works  
✅ Invalid names still rejected  
✅ All 30 tests passing  
✅ No TypeScript errors  
✅ Backward compatible  

---

## Testing Checklist

### Automated Testing
- ✅ Unit tests created (30 tests)
- ✅ All tests passing
- ✅ Edge cases covered
- ✅ Real-world examples tested
- ✅ TypeScript compilation passes

### Manual Testing Required
1. ⏳ Test with real MCP servers
2. ⏳ Test with extension tools
3. ⏳ Test with various LLM models
4. ⏳ Verify error messages are clear
5. ⏳ Test with long tool names

---

## Lessons Learned

### What Went Well
1. **Simple Fix:** Minimal code change with big impact
2. **Comprehensive Tests:** 30 tests cover all scenarios
3. **Clear Benefit:** Enables important integrations
4. **No Breaking Changes:** Fully backward compatible

### What Could Be Improved
1. **Documentation:** Could add more user-facing docs
2. **Validation Timing:** Could move to registration time
3. **Namespace Rules:** Could add optional namespace validation

### Best Practices Applied
1. **Test-Driven:** Created comprehensive tests
2. **Clear Comments:** Documented the change
3. **Edge Cases:** Handled all edge cases
4. **Real-World Focus:** Tested with actual use cases

---

## Conclusion

Fix 3.3 is complete and successful. Tool schema validation now accepts namespaced tool names with dots and slashes, enabling MCP servers, extensions, and external tools to use standard naming conventions. All tests pass, and the fix is fully backward compatible.

**Ready to proceed with remaining Phase 3 & 4 fixes**

---

**Completed:** January 19, 2026  
**Time Spent:** ~30 minutes  
**Next Fix:** 3.1 - Improve JSON-in-Content Detection (P2 - MEDIUM)

---

## Quick Reference

### Validation Pattern
```typescript
// Regex pattern
/^[a-zA-Z_][a-zA-Z0-9_.\/-]*$/

// Allowed characters
- Start: letter or underscore
- Body: letter, number, underscore, dash, dot, slash
```

### Example Valid Names
```typescript
'search'                          // Simple
'search_documents'                // Underscore
'search-documents'                // Dash
'mcp.search'                      // Dot (namespace)
'github/search'                   // Slash (namespace)
'mcp.github/search'               // Mixed
'ext.code-analysis.lint'          // Complex
```

### Test Command
```bash
npm test -- toolSchemaValidation.test.ts
```

---

**Status:** ✅ COMPLETE  
**Tests:** 30/30 passing  
**Confidence Level:** High
