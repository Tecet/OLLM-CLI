# Large File Split Analysis

## Objective
Identify files exceeding 1000 lines and propose logical module splits to improve maintainability, testing, and readability.

## Candidates for Refactoring
The following files have been flagged as significantly large (>1000 LOC):

1. `packages/cli/src/features/context/ChatContext.tsx` (~1359 lines)
2. `packages/cli/src/ui/components/tabs/MCPTab.tsx` (~1994 lines)
3. `packages/cli/src/ui/contexts/MCPContext.tsx` (~1180 lines)
4. `packages/cli/src/ui/App.tsx` (~1289 lines)
5. `packages/ollm-bridge/src/provider/localProvider.ts` (~1174 lines)

---

## Refactoring Proposals

### 1. ChatContext.tsx
**Current Responsibilities:** State management, Networking (`sendToLLM`), Menu system, Scrolling logic, Tool handling, Event listeners.
**Proposed Split:**
- **`src/features/chat/types.ts`**: Extract all interfaces (`Message`, `ChatState`, `MenuOption`).
- **`src/features/chat/hooks/useChatNetwork.ts`**: Encapsulate `sendToLLM` and connection logic.
- **`src/features/chat/hooks/useChatState.ts`**: Manage the core message list and loading state.
- **`src/features/chat/hooks/useMenuSystem.ts`**: Isolate all menu-related state and logic.
- **`src/features/chat/hooks/useScrollManager.ts`**: Handle scrolling logic.
- **`ChatProvider.tsx`**: Keep this as the composition layer that uses the above hooks.

### 2. MCPTab.tsx
**Current Responsibilities:** UI Layout, Data fetching, Dialog management, Sub-components (ServerDetails, Marketplace).
**Proposed Split:**
- **`src/ui/components/mcp/ServerDetailsView.tsx`**: Extract the `ServerDetailsContent` component (~600 lines).
- **`src/ui/components/mcp/MarketplaceView.tsx`**: Extract the `MarketplaceContent` component (~500 lines).
- **`src/ui/components/mcp/MCPLayout.tsx`**: Handle the two-column layout and menu rendering.
- **`src/ui/components/mcp/types.ts`**: Shared types for dialogs and views.

### 3. MCPContext.tsx
**Current Responsibilities:** State management, Marketplace logic, Health monitoring, Tool registration.
**Proposed Split:**
- **`src/ui/hooks/mcp/useMCPServers.ts`**: Logic for CRUD operations on servers.
- **`src/ui/hooks/mcp/useMCPMarketplace.ts`**: Logic for searching/installing from marketplace.
- **`src/ui/hooks/mcp/useMCPHealth.ts`**: Health monitoring logic.
- **`MCPProvider.tsx`**: Compose these hooks to provide the context value.

### 4. App.tsx
**Current Responsibilities:** Context Provider Tree, Main Layout, Global Event Handling, Tab Rendering.
**Proposed Split:**
- **`src/ui/providers/AppProviders.tsx`**: Extract the massive nest of Context Providers into a clean wrapper component.
- **`src/ui/layout/MainLayout.tsx`**: Extract the high-level layout (SystemBar, TabBar, SidePanel).
- **`src/ui/hooks/useGlobalNavigation.ts`**: Extract tab switching and keyboard shortcut logic.
- **`App.tsx`**: Should be reduced to ~100 lines, mainly bootstrapping the `AppProviders` and `MainLayout`.

### 5. localProvider.ts (ollm-bridge)
**Current Responsibilities:** HTTP Client, JSON Schema Validation, Event Mapping, Error Handling heuristics.
**Proposed Split:**
- **`src/utils/jsonSchema.ts`**: Extract `validateJsonSchema` and `validateToolSchema` (~200 lines).
- **`src/provider/mappers.ts`**: Extract `mapMessages`, `mapTools`, and `mapChunkToEvents`.
- **`src/utils/ollamaErrors.ts`**: Extract error detection logic (`isToolUnsupportedError`, `formatHttpError`).
- **`localProvider.ts`**: Keep as the clean coordinator class implementing `ProviderAdapter`.

## Implementation Strategy
1.  **Stop the Bleeding**: Don't add more code to these files.
2.  **Extract Utils First**: Move pure functions (validators, mappers) to utility files first, as this is low-risk.
3.  **Extract Components/Hooks**: Move UI sections to components and logic to hooks.
4.  **Verify**: Ensure existing tests pass (or add snapshot tests) before major structural changes.
