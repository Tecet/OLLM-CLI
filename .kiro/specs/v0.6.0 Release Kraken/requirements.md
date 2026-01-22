# Requirements Document

## Introduction

The Kraken Integration feature enables OLLM CLI to access powerful external LLM providers when local open-source models need assistance with complex tasks. This "escape hatch" provides seamless access to both CLI-based coding agents (Gemini CLI, Claude Code, Codex CLI) and API-based cloud models (OpenAI, Anthropic, Google AI) while maintaining the same unified interface and tool ecosystem.

## Glossary

- **Kraken**: The collective term for external LLM providers accessible through OLLM CLI
- **CLI_Bridge**: A subprocess-based executor that invokes terminal-based coding agents
- **API_Provider**: An HTTPS-based adapter for cloud LLM APIs
- **Kraken_Manager**: The orchestration component that handles provider selection and escalation
- **Local_Model**: The default open-source LLM running through Ollama
- **Escalation**: The process of transferring control from a local model to a Kraken provider
- **Context_Transfer**: The mechanism for sharing conversation context between local and Kraken providers
- **Provider_Registry**: The central registry managing all available LLM providers
- **Session_Budget**: A cost limit enforced per user session to prevent runaway expenses
- **Health_Check**: A validation process to verify provider availability and authentication status

## Requirements

### Requirement 1: CLI Bridge Execution

**User Story:** As a developer, I want to invoke terminal-based coding agents (Gemini CLI, Claude Code, Codex CLI) from within OLLM CLI, so that I can leverage their specialized capabilities without leaving my workflow.

#### Acceptance Criteria

1. WHEN a CLI tool is configured, THE CLI_Bridge SHALL discover the executable on the system PATH or configured location
2. WHEN executing a CLI tool, THE CLI_Bridge SHALL send prompts via STDIN to avoid command-line length limits
3. WHEN a CLI tool produces output, THE CLI_Bridge SHALL parse the response into structured events (text, code blocks, JSON)
4. WHEN a CLI execution exceeds the configured timeout, THE CLI_Bridge SHALL terminate the process and return a timeout error
5. WHEN a CLI tool is not found, THE CLI_Bridge SHALL provide an actionable error message with installation instructions
6. WHEN running on Windows, THE CLI_Bridge SHALL use thread pool execution to handle subprocess compatibility
7. WHEN a proxy URL is configured, THE CLI_Bridge SHALL route requests through the HTTP proxy instead of direct execution

### Requirement 2: API Provider Integration

**User Story:** As a developer, I want to access cloud-based LLM APIs (OpenAI, Anthropic, Google AI) through OLLM CLI, so that I can use cutting-edge models for complex reasoning tasks.

#### Acceptance Criteria

1. WHEN an API provider is configured with valid credentials, THE API_Provider SHALL authenticate and establish connectivity
2. WHEN sending a request to an API provider, THE API_Provider SHALL format the request according to the provider's specification
3. WHEN receiving a streaming response, THE API_Provider SHALL parse Server-Sent Events (SSE) into ProviderEvent objects
4. WHEN an API request completes, THE API_Provider SHALL calculate and track token usage and cost
5. WHEN an API key is invalid or expired, THE API_Provider SHALL return a clear authentication error
6. WHEN a requested model is not available, THE API_Provider SHALL return a list of available models
7. WHEN network connectivity fails, THE API_Provider SHALL retry with exponential backoff up to 3 attempts

### Requirement 3: Provider Discovery and Health Checks

**User Story:** As a developer, I want OLLM CLI to automatically detect and validate available Kraken providers, so that I know which external resources are ready to use.

#### Acceptance Criteria

1. WHEN OLLM CLI starts, THE Kraken_Manager SHALL perform health checks on all configured providers
2. WHEN checking a CLI tool, THE Health_Check SHALL verify the executable exists and is executable
3. WHEN checking a CLI tool, THE Health_Check SHALL detect the tool version by executing `--version`
4. WHEN checking a CLI tool, THE Health_Check SHALL determine if authentication is required
5. WHEN checking an API provider, THE Health_Check SHALL validate the API key and connectivity within 5 seconds
6. WHEN a health check fails, THE Kraken_Manager SHALL log the failure reason and mark the provider as unavailable
7. WHEN the user requests provider status, THE Kraken_Manager SHALL display the health status of all configured providers

### Requirement 4: Kraken Manager and Provider Selection

**User Story:** As a developer, I want OLLM CLI to intelligently select the best Kraken provider for my task, so that I get optimal results without manual configuration.

#### Acceptance Criteria

1. WHEN the user invokes `/kraken` without specifying a provider, THE Kraken_Manager SHALL present an interactive provider selection menu
2. WHEN selecting a provider automatically, THE Kraken_Manager SHALL consider task complexity, domain, and context size requirements
3. WHEN multiple providers are available, THE Kraken_Manager SHALL prefer CLI-based providers over API providers for cost efficiency
4. WHEN a preferred provider is configured, THE Kraken_Manager SHALL use it as the default selection
5. WHEN a provider is unavailable, THE Kraken_Manager SHALL exclude it from selection options
6. WHEN no providers are available, THE Kraken_Manager SHALL return an error with configuration guidance
7. WHEN the user specifies a provider name, THE Kraken_Manager SHALL use that provider if available

### Requirement 5: Context Transfer and Session Management

**User Story:** As a developer, I want my conversation context to transfer seamlessly to Kraken providers, so that external models have the necessary background to assist effectively.

#### Acceptance Criteria

1. WHEN releasing Kraken with context inheritance enabled, THE Context_Transfer SHALL export the current conversation summary
2. WHEN exporting context, THE Context_Transfer SHALL include recent messages, active files, current task, and tool results
3. WHEN context exceeds the Kraken provider's limit, THE Context_Transfer SHALL compress the context using summarization
4. WHEN a Kraken provider responds, THE Context_Transfer SHALL import the response into the local session
5. WHEN returning to the local model, THE Context_Transfer SHALL merge Kraken insights with the existing conversation
6. WHEN context transfer fails, THE Kraken_Manager SHALL proceed with a minimal context summary
7. WHEN the user disables context inheritance, THE Kraken_Manager SHALL send only the current prompt

### Requirement 6: Cost Tracking and Budget Enforcement

**User Story:** As a developer, I want OLLM CLI to track and limit my Kraken usage costs, so that I don't accidentally exceed my budget when using paid APIs.

#### Acceptance Criteria

1. WHEN an API provider completes a request, THE Cost_Tracker SHALL calculate the cost based on token usage and provider pricing
2. WHEN a session budget is configured, THE Cost_Tracker SHALL enforce the limit before allowing Kraken invocations
3. WHEN the session budget is exceeded, THE Kraken_Manager SHALL reject new Kraken requests with a budget error
4. WHEN displaying Kraken status, THE Cost_Tracker SHALL show remaining budget and total session costs
5. WHEN a new session starts, THE Cost_Tracker SHALL reset the session budget counter
6. WHEN cost warnings are enabled, THE Cost_Tracker SHALL display estimated costs before executing expensive requests
7. WHEN logging is enabled, THE Cost_Tracker SHALL record all Kraken usage with timestamps and costs

### Requirement 7: Slash Command Interface

**User Story:** As a developer, I want intuitive slash commands to interact with Kraken providers, so that I can quickly access external LLMs without complex configuration.

#### Acceptance Criteria

1. WHEN the user types `/kraken`, THE CLI SHALL display an interactive provider selection menu
2. WHEN the user types `/kraken <prompt>`, THE CLI SHALL send the prompt to the default Kraken provider
3. WHEN the user types `/kraken status`, THE CLI SHALL display the health and availability of all providers
4. WHEN the user types `/kraken config`, THE CLI SHALL open the Kraken configuration file for editing
5. WHEN the user types `/kraken history`, THE CLI SHALL display recent Kraken usage with costs and timestamps
6. WHEN the user types `/k` or `/release`, THE CLI SHALL recognize these as aliases for `/kraken`
7. WHEN a Kraken command is executed, THE CLI SHALL display the provider name and model in the response header

### Requirement 8: Policy and Confirmation System

**User Story:** As a developer, I want control over when Kraken providers are invoked, so that I can review costs and context sharing before external requests are made.

#### Acceptance Criteria

1. WHEN `confirmBeforeRelease` is enabled, THE Policy_Engine SHALL display a confirmation dialog before invoking Kraken
2. WHEN displaying confirmation, THE Policy_Engine SHALL show the provider, model, context to be shared, and estimated cost
3. WHEN the user approves a Kraken request, THE Policy_Engine SHALL proceed with the invocation
4. WHEN the user rejects a Kraken request, THE Policy_Engine SHALL cancel the operation and return control to the local model
5. WHEN the user selects "Always allow", THE Policy_Engine SHALL add the provider to the auto-approve list
6. WHEN a provider is in the allowed list, THE Policy_Engine SHALL skip confirmation for that provider
7. WHEN cost warnings are enabled, THE Policy_Engine SHALL display a warning if the estimated cost exceeds $1.00

### Requirement 9: Auto-Escalation

**User Story:** As a developer, I want OLLM CLI to automatically escalate to Kraken providers when local models fail, so that I can get help without manual intervention.

#### Acceptance Criteria

1. WHEN auto-escalation is enabled and a local model returns an error, THE Kraken_Manager SHALL trigger escalation
2. WHEN auto-escalation is enabled and context overflow occurs, THE Kraken_Manager SHALL escalate to a provider with larger context
3. WHEN auto-escalation is enabled and the user says "I need help", THE Kraken_Manager SHALL offer to release Kraken
4. WHEN escalation is triggered, THE Kraken_Manager SHALL select the most appropriate provider based on the failure reason
5. WHEN escalation occurs, THE Kraken_Manager SHALL emit a `kraken_escalate` hook event with the reason
6. WHEN auto-escalation is disabled, THE Kraken_Manager SHALL not automatically invoke Kraken providers
7. WHEN escalation fails, THE Kraken_Manager SHALL return control to the user with an error message

### Requirement 10: Hook System Integration

**User Story:** As a developer, I want to customize Kraken behavior through hooks, so that I can add logging, notifications, or custom policies.

#### Acceptance Criteria

1. WHEN Kraken is about to be invoked, THE Hook_System SHALL emit a `before_kraken` event with provider and prompt details
2. WHEN Kraken completes a response, THE Hook_System SHALL emit an `after_kraken` event with response, tokens, and cost
3. WHEN auto-escalation triggers, THE Hook_System SHALL emit a `kraken_escalate` event with the escalation reason
4. WHEN a hook handler is registered for `before_kraken`, THE Hook_System SHALL execute it before proceeding
5. WHEN a hook handler returns false, THE Hook_System SHALL cancel the Kraken invocation
6. WHEN a hook handler throws an error, THE Hook_System SHALL log the error and continue with the invocation
7. WHEN multiple hooks are registered, THE Hook_System SHALL execute them in registration order

### Requirement 11: Configuration Management

**User Story:** As a developer, I want to configure Kraken providers through YAML files, so that I can manage credentials and settings in a familiar format.

#### Acceptance Criteria

1. WHEN OLLM CLI loads configuration, THE Config_Loader SHALL parse the `kraken` section from `~/.ollm/config.yaml`
2. WHEN a CLI provider is configured, THE Config_Loader SHALL validate required fields (tool, timeout, defaultModel)
3. WHEN an API provider is configured, THE Config_Loader SHALL validate required fields (provider, apiKey, model)
4. WHEN an API key references an environment variable, THE Config_Loader SHALL resolve it at runtime
5. WHEN configuration is invalid, THE Config_Loader SHALL return validation errors with field-specific messages
6. WHEN configuration changes, THE Config_Loader SHALL support hot-reload without restarting OLLM CLI
7. WHEN no Kraken configuration exists, THE Config_Loader SHALL use default settings with all providers disabled

### Requirement 12: UI and Status Display

**User Story:** As a developer, I want visual feedback about Kraken status and usage, so that I can monitor external provider activity at a glance.

#### Acceptance Criteria

1. WHEN Kraken providers are available, THE Status_Bar SHALL display a "🦑 Ready" indicator
2. WHEN Kraken is actively processing a request, THE Status_Bar SHALL display "🦑 Active"
3. WHEN no Kraken providers are configured, THE Status_Bar SHALL display "🦑 ---"
4. WHEN the session budget is exceeded, THE Status_Bar SHALL display "🦑 ⚠️"
5. WHEN displaying a Kraken response, THE CLI SHALL use a distinct visual style with provider name and model
6. WHEN displaying a Kraken response, THE CLI SHALL show token counts, cost, and response time in the footer
7. WHEN displaying the provider selection menu, THE CLI SHALL indicate which providers are available with checkmarks

### Requirement 13: Error Handling and Recovery

**User Story:** As a developer, I want clear error messages and recovery options when Kraken operations fail, so that I can troubleshoot issues quickly.

#### Acceptance Criteria

1. WHEN a CLI tool is not found, THE Error_Handler SHALL provide installation instructions specific to the tool
2. WHEN authentication is required, THE Error_Handler SHALL provide the authentication command for the CLI tool
3. WHEN a proxy is unreachable, THE Error_Handler SHALL suggest checking the proxy URL and network connectivity
4. WHEN a timeout occurs, THE Error_Handler SHALL suggest increasing the timeout or trying a different provider
5. WHEN a model is not found, THE Error_Handler SHALL list available models for the provider
6. WHEN the budget is exceeded, THE Error_Handler SHALL show the current limit and suggest increasing it
7. WHEN an API request fails, THE Error_Handler SHALL include the HTTP status code and provider error message

### Requirement 14: Security and Privacy

**User Story:** As a developer, I want assurance that my code and credentials are handled securely when using Kraken providers, so that I can trust the system with sensitive information.

#### Acceptance Criteria

1. WHEN storing API keys, THE Config_Manager SHALL support environment variable references to avoid plaintext storage
2. WHEN sharing context with external providers, THE Privacy_Guard SHALL warn users if sensitive information is detected
3. WHEN logging Kraken usage, THE Logger SHALL redact API keys and sensitive data from log files
4. WHEN a provider requires authentication, THE Auth_Manager SHALL use secure credential storage mechanisms
5. WHEN displaying confirmation dialogs, THE Privacy_Guard SHALL summarize context without exposing sensitive details
6. WHEN audit logging is enabled, THE Audit_Logger SHALL record all Kraken invocations with timestamps and user identifiers
7. WHEN transmitting data to external providers, THE Transport_Layer SHALL use HTTPS encryption

### Requirement 15: Cross-Platform Compatibility

**User Story:** As a developer, I want Kraken integration to work consistently across Windows, macOS, and Linux, so that I can use the same configuration on all my machines.

#### Acceptance Criteria

1. WHEN discovering CLI executables on Windows, THE Discovery_Service SHALL check both `.exe` and `.cmd` extensions
2. WHEN discovering CLI executables on Unix systems, THE Discovery_Service SHALL check PATH and common installation directories
3. WHEN executing subprocesses on Windows, THE Subprocess_Manager SHALL use thread pool execution for compatibility
4. WHEN executing subprocesses on Unix systems, THE Subprocess_Manager SHALL use standard fork/exec mechanisms
5. WHEN resolving paths, THE Path_Resolver SHALL use platform-specific path separators and conventions
6. WHEN handling environment variables, THE Env_Manager SHALL support both Windows and Unix variable syntax
7. WHEN displaying UI elements, THE Renderer SHALL use cross-platform terminal escape sequences
