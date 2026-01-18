import React, { useState, useMemo, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { useUI } from '../../../features/context/UIContext.js';
import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useSettings } from '../../../features/context/SettingsContext.js';
import { useModel } from '../../../features/context/ModelContext.js';
import { builtInThemes } from '../../../config/styles.js';
import { profileManager } from '../../../features/profiles/ProfileManager.js';

const WINDOW_SIZE = 30; // Configurable window size

interface Section {
  id: string;
  name: string;
}

const sections: Section[] = [
  { id: 'provider', name: 'Provider Selection' },
  { id: 'model', name: 'LLM Models' },
  { id: 'options', name: 'LLM Options' },
  { id: 'theme', name: 'Theme Selection' },
];

/**
 * SettingsPanel Component
 * 
 * Two-column settings interface:
 * - Left (30%): Section navigation
 * - Right (70%): Settings editor
 * 
 * Navigation:
 * - Up/Down: Navigate sections/settings
 * - Left/Right: Switch between columns
 * - Enter: Select section or edit setting
 * - Esc/0: Exit to nav-bar
 */
export function SettingsPanel() {
  const { state: uiState } = useUI();
  const focusManager = useFocusManager();
  const { settings, updateLLMSetting, updateUISetting } = useSettings();
  const { currentModel, setCurrentModel } = useModel();
  const hasFocus = focusManager.isFocused('settings-panel');

  // State
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  const [selectedSettingIndex, setSelectedSettingIndex] = useState(0);
  const [focusedColumn, setFocusedColumn] = useState<'left' | 'right'>('left');
  const [scrollOffset, _setScrollOffset] = useState(0);
  const [rightScrollOffset, setRightScrollOffset] = useState(0);
  const [isOnExitItem, setIsOnExitItem] = useState(false);
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [editValue, setEditValue] = useState('');

  // Get current section
  const currentSection = useMemo(() => {
    if (isOnExitItem || selectedSectionIndex >= sections.length) {
      return null;
    }
    return sections[selectedSectionIndex];
  }, [selectedSectionIndex, isOnExitItem]);

  // Options for select types
  const getOptionsForSetting = useCallback((settingId: string) => {
    switch (settingId) {
      case 'provider':
        return ['ollama', 'openai', 'anthropic', 'local'];
      case 'model':
        // For now, hardcode some common ones or get from current model
        return ['llama3.2:3b', 'llama3.3:70b', 'qwen2.5-coder:7b', 'phi3'];
      case 'theme':
        return Object.keys(builtInThemes);
      default:
        return [];
    }
  }, []);

  // Get settings for current section
  const currentSettings = useMemo(() => {
    if (!currentSection) return [];

    switch (currentSection.id) {
      case 'provider':
        return [
          { id: 'local_header', label: '1 Local LLM Providers:', value: '', type: 'header', category: 'llm' },
          { id: 'h_spacer_1', label: '', value: '', type: 'info', category: 'llm' }, // Padding
          { id: 'prov_ollama', label: 'Ollama', value: 'ollama', active: (settings.llm.provider || 'ollama') === 'ollama', type: 'choice', category: 'llm' },
          { id: 'prov_ollama_cloud', label: 'Ollama Cloud [ coming soon ]', value: 'ollama_cloud', type: 'choice', category: 'llm', muted: true },
          { id: 'prov_llm_studio', label: 'LLM Studio [ coming soon ]', value: 'llm_studio', type: 'choice', category: 'llm', muted: true },
          { id: 'prov_vllm', label: 'vLLM [ coming soon ]', value: 'vllm', type: 'choice', category: 'llm', muted: true },
          { id: 'prov_llama_cpp', label: 'Llama cpp [ coming soon ]', value: 'llama_cpp', type: 'choice', category: 'llm', muted: true },
          { id: 'prov_mlx_lm', label: 'MLX-LM [ coming soon ]', value: 'mlx_lm', type: 'choice', category: 'llm', muted: true },
          
          { id: 'spacer_p1', label: '', value: '', type: 'info', category: 'llm' },
          
          { id: 'kraken_header', label: '2 Kraken', value: '', type: 'header', category: 'llm' },
          { id: 'h_spacer_2', label: '', value: '', type: 'info', category: 'llm' }, // Padding
          { id: 'prov_claude_code', label: 'Claude Code CLI [ coming soon ]', value: 'claude_code', type: 'choice', category: 'llm', muted: true },
          { id: 'prov_codex', label: 'Codex CLI [ coming soon ]', value: 'codex', type: 'choice', category: 'llm', muted: true },
          { id: 'prov_gemini_cli', label: 'Gemini CLI [ coming soon ]', value: 'gemini_cli', type: 'choice', category: 'llm', muted: true },

          { id: 'spacer_p2', label: '', value: '', type: 'info', category: 'llm' },

          { id: 'rag_header', label: '3 RAG Embedding Model', value: '', type: 'header', category: 'llm' },
          { id: 'h_spacer_3', label: '', value: '', type: 'info', category: 'llm' }, // Padding
          { id: 'rag_model', label: 'Model Name/ID', value: 'Embedding LLM', type: 'info', category: 'llm' },
          { id: 'rag_api', label: 'API', value: '*******', type: 'info', category: 'llm' },
          { id: 'rag_dim', label: 'Dimensions', value: '1024', type: 'info', category: 'llm' },
          { id: 'rag_chunk', label: 'Chunk Size (Max Tokens)', value: '512', type: 'info', category: 'llm' },

          { id: 'spacer_p3', label: '', value: '', type: 'info', category: 'llm' },

          { id: 'api_header', label: '4 API LLMs Providers', value: '', type: 'header', category: 'llm' },
          { id: 'h_spacer_4', label: '', value: '', type: 'info', category: 'llm' }, // Padding
          { id: 'api_prov', label: 'LLM Provider', value: ' ', type: 'info', category: 'llm', muted_value: true },
          { id: 'api_add', label: '+ Add API', value: '', type: 'choice', category: 'llm', muted: true },
        ];
      case 'model': {
        const userModels = profileManager.getUserModels();
        const modelEntry = userModels.find(m => m.id === currentModel);
        const profile = profileManager.getProfileById(currentModel) || profileManager.findProfile(currentModel);
        
        const settingsList: any[] = [
          { id: 'model_name', label: 'Model', value: currentModel, type: 'info', category: 'llm' },
        ];

        if (modelEntry) {
          const ctxProfile = modelEntry.context_profiles?.find(p => p.size === settings.llm.contextSize) || modelEntry.context_profiles?.[0];
          settingsList.push({ id: 'model_ctx', label: 'Context Size', value: ctxProfile?.size_label || modelEntry.default_context || 'N/A', type: 'info', category: 'llm' });
          
          if (profile?.ollama_url) {
             settingsList.push({ id: 'model_url', label: 'Ollama URL', value: profile.ollama_url, type: 'info', category: 'llm' });
          }
          
          settingsList.push({ id: 'model_tools', label: 'Tool Support', value: modelEntry.tool_support ? '✓ Supported' : '✗ Not Supported', type: 'info', category: 'llm' });
          
          if (profile?.thinking_enabled || modelEntry.abilities?.includes('Reasoning')) {
             settingsList.push({ id: 'model_reasoning', label: 'Reasoning', value: '✓ Enabled', type: 'info', category: 'llm' });
          }
          
          
          settingsList.push({ id: 'model_desc', label: 'Description', value: modelEntry.description || 'No description available.', type: 'info', category: 'llm' });
          
          // Add 3 lines padding under description
          settingsList.push({ id: 'spacer1', label: '', value: '', type: 'info', category: 'llm' });
          settingsList.push({ id: 'spacer2', label: '', value: '', type: 'info', category: 'llm' });
          settingsList.push({ id: 'spacer3', label: '', value: '', type: 'info', category: 'llm' });
        }

        settingsList.push({ id: 'available_models_header', label: 'Available Models:', value: '', type: 'header', category: 'llm' });
        
        // Add line space between header and list
        settingsList.push({ id: 'list_spacer', label: '', value: '', type: 'info', category: 'llm' });
        
        // Display in alphabetical order
        [...userModels].sort((a, b) => a.id.localeCompare(b.id)).forEach(m => {
          settingsList.push({
            id: 'model',
            label: m.id,
            value: m.id,
            active: m.id === currentModel,
            type: 'choice',
            category: 'llm'
          });
        });

        return settingsList;
      }
      case 'options':
        return [
          { id: 'temperature', label: 'Temperature', value: settings.llm.temperature || 0.7, type: 'numeric' as const, min: 0, max: 2, step: 0.1, category: 'llm' },
          { id: 'contextSize', label: 'Max Tokens', value: settings.llm.contextSize || 4096, type: 'numeric' as const, category: 'llm' },
          { id: 'reviewMode', label: 'Review Mode', value: (settings as any).prompt?.mode === 'review', type: 'toggle' as const, category: 'prompt' },
          { id: 'metricsEnabled', label: 'Metrics', value: settings.ui.metricsEnabled ?? true, type: 'toggle' as const, category: 'ui' },
          { id: 'reasoningEnabled', label: 'Reasoning', value: settings.ui.reasoningEnabled ?? true, type: 'toggle' as const, category: 'ui' },
        ];
      case 'theme':
        return Object.keys(builtInThemes).map(themeId => ({
          id: 'theme',
          label: themeId,
          value: themeId,
          active: (settings.ui.theme || uiState.theme.name) === themeId,
          type: 'choice' as const,
          category: 'ui'
        }));
      default:
        return [];
    }
  }, [currentSection, settings, uiState.theme.name, currentModel]);

  // Is focusable helper
  const isFocusable = (setting: any) => {
    return setting.type !== 'info' && setting.type !== 'header' && !setting.muted;
  };

  // Navigation handlers
  const handleNavigateUp = () => {
    if (focusedColumn === 'right' && !isEditingValue) {
      // Navigate settings in right column - find previous focusable
      let nextIdx = selectedSettingIndex - 1;
      while (nextIdx >= 0 && !isFocusable(currentSettings[nextIdx])) {
        nextIdx--;
      }
      
      if (nextIdx >= 0) {
        setSelectedSettingIndex(nextIdx);
        // Update scroll offset if needed
        if (nextIdx < rightScrollOffset) {
          setRightScrollOffset(nextIdx);
        }
      }
      return;
    }

    if (focusedColumn === 'left') {
      // Left column navigation
      if (isOnExitItem) {
        return; // Already at top
      }

      if (selectedSectionIndex > 0) {
        setSelectedSectionIndex(prev => prev - 1);
        setSelectedSettingIndex(0); // Reset setting index when changing section
        setRightScrollOffset(0); // Reset scroll offset
      } else {
        // Move to Exit
        setIsOnExitItem(true);
      }
    }
  };

  const handleNavigateDown = () => {
    if (focusedColumn === 'right' && !isEditingValue) {
      // Navigate settings in right column - find next focusable
      let nextIdx = selectedSettingIndex + 1;
      while (nextIdx < currentSettings.length && !isFocusable(currentSettings[nextIdx])) {
        nextIdx++;
      }

      if (nextIdx < currentSettings.length) {
        setSelectedSettingIndex(nextIdx);
        // Update scroll offset if needed
        if (nextIdx >= rightScrollOffset + WINDOW_SIZE) {
          setRightScrollOffset(nextIdx - WINDOW_SIZE + 1);
        }
      }
      return;
    }

    if (focusedColumn === 'left') {
      // Left column navigation
      if (isOnExitItem) {
        // Move from Exit to first section
        setIsOnExitItem(false);
        setSelectedSectionIndex(0);
        setSelectedSettingIndex(0);
        return;
      }

      if (selectedSectionIndex < sections.length - 1) {
        setSelectedSectionIndex(prev => prev + 1);
        setSelectedSettingIndex(0); // Reset setting index when changing section
        setRightScrollOffset(0); // Reset scroll offset
      }
    }
  };

  const handleSwitchColumn = (direction: 'left' | 'right') => {
    if (isEditingValue) return; // Can't switch while editing

    if (direction === 'right' && focusedColumn === 'left' && currentSection) {
      // Move to right column - find first focusable
      let firstFocusable = 0;
      while (firstFocusable < currentSettings.length && !isFocusable(currentSettings[firstFocusable])) {
        firstFocusable++;
      }
      setFocusedColumn('right');
      setSelectedSettingIndex(firstFocusable < currentSettings.length ? firstFocusable : 0);
    } else if (direction === 'left' && focusedColumn === 'right') {
      setFocusedColumn('left');
    }
  };

  const handleToggleSetting = () => {
    if (focusedColumn !== 'right' || currentSettings.length === 0) return;

    const setting = currentSettings[selectedSettingIndex];
    if (setting.type === 'toggle') {
      if (setting.category === 'llm' || setting.category === 'prompt') {
          updateLLMSetting(setting.id, !setting.value);
      } else {
          updateUISetting(setting.id, !setting.value);
      }
    }
  };

  const handleEnterOnSetting = () => {
    if (focusedColumn !== 'right' || currentSettings.length === 0) return;

    const setting = currentSettings[selectedSettingIndex];
    
    if (setting.type === 'numeric') {
      setIsEditingValue(true);
      setEditValue(String(setting.value));
    } else if (setting.type === 'toggle') {
      handleToggleSetting();
    } else if (setting.type === 'choice') {
      if (setting.id === 'model') {
          setCurrentModel(String(setting.value));
      }

      if (setting.category === 'llm') {
          updateLLMSetting(setting.id, String(setting.value));
      } else {
          updateUISetting(setting.id, String(setting.value));
      }
    } else if (setting.type === 'select') {
      // Toggle through options
      const options = getOptionsForSetting(setting.id);
      const currentIndex = options.indexOf(String(setting.value));
      const nextIndex = (currentIndex + 1) % options.length;
      const nextValue = options[nextIndex];
      
      if (setting.id === 'model') {
          setCurrentModel(nextValue);
      }

      if (setting.category === 'llm') {
          updateLLMSetting(setting.id, nextValue);
      } else {
          updateUISetting(setting.id, nextValue);
      }
    }
  };

  const handleSaveEdit = () => {
    if (!isEditingValue) return;

    const setting = currentSettings[selectedSettingIndex];
    const numValue = parseFloat(editValue);
    
    if (!isNaN(numValue)) {
      if (setting.category === 'llm') {
          updateLLMSetting(setting.id, numValue);
      } else {
          updateUISetting(setting.id, numValue);
      }
    }
    
    setIsEditingValue(false);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setIsEditingValue(false);
    setEditValue('');
  };

  const handleExit = () => {
    if (isEditingValue) {
      handleCancelEdit();
    } else {
      focusManager.exitToNavBar();
    }
  };

  // Handle keyboard input
  useInput((input, key) => {
    if (!hasFocus) return;

    if (isEditingValue) {
      // In edit mode
      if (key.return) {
        handleSaveEdit();
      } else if (key.escape) {
        handleCancelEdit();
      } else if (key.backspace || key.delete) {
        setEditValue(prev => prev.slice(0, -1));
      } else if (input && /[0-9.]/.test(input)) {
        setEditValue(prev => prev + input);
      }
    } else {
      // Normal navigation
      if (key.upArrow) {
        handleNavigateUp();
      } else if (key.downArrow) {
        handleNavigateDown();
      } else if (key.leftArrow) {
        handleSwitchColumn('left');
      } else if (key.rightArrow) {
        handleSwitchColumn('right');
      } else if (key.return) {
        if (isOnExitItem) {
          handleExit();
        } else if (focusedColumn === 'right') {
          handleEnterOnSetting();
        }
      } else if (key.escape || input === '0') {
        handleExit();
      }
    }
  }, { isActive: hasFocus });

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box
        borderStyle="single"
        borderColor={hasFocus ? uiState.theme.text.accent : uiState.theme.text.secondary}
        paddingX={1}
        flexShrink={0}
      >
        <Box justifyContent="space-between" width="100%">
          <Box marginRight={2}>
            <Text bold color={hasFocus ? uiState.theme.text.accent : uiState.theme.text.primary}>
              Settings
            </Text>
          </Box>
          <Box>
            <Text color={hasFocus ? uiState.theme.text.primary : uiState.theme.text.secondary}>
              ↑↓:Nav ←→:Column Enter:Edit 0/Esc:Exit
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Two-column layout */}
      <Box flexGrow={1} overflow="hidden">
        {/* Left column: Section list (30%) */}
        <Box 
          flexDirection="column" 
          width="30%" 
          borderStyle="single" 
          borderColor={focusedColumn === 'left' && hasFocus ? uiState.theme.border.active : uiState.theme.border.primary}
        >
          {/* Scroll indicator at top */}
          {scrollOffset > 0 && (
            <>
              <Box justifyContent="center" paddingX={1}>
                <Text color={uiState.theme.text.secondary}>
                  ▲ Scroll up for more
                </Text>
              </Box>
              <Text> </Text>
            </>
          )}

          {/* Scrollable content area */}
          <Box flexDirection="column" flexGrow={1} paddingX={1}>
            {/* Empty line at top */}
            <Text> </Text>

            {/* Exit item */}
            <Box>
              <Text
                bold={isOnExitItem && hasFocus}
                color={isOnExitItem && hasFocus ? 'yellow' : uiState.theme.text.primary}
              >
                ← Exit
              </Text>
            </Box>
            <Text> </Text>
            <Text> </Text>

            {/* Sections */}
            {sections.map((section, idx) => {
              const isSelected = !isOnExitItem && idx === selectedSectionIndex && focusedColumn === 'left';
              
              return (
                <Box key={section.id} marginTop={idx > 0 ? 1 : 0}>
                  <Text
                    bold={isSelected && hasFocus}
                    color={isSelected && hasFocus ? 'yellow' : uiState.theme.text.primary}
                  >
                    {section.name}
                  </Text>
                </Box>
              );
            })}
          </Box>

          {/* Scroll indicator at bottom */}
          {scrollOffset + WINDOW_SIZE < sections.length + 1 && (
            <>
              <Text> </Text>
              <Box justifyContent="center" paddingX={1}>
                <Text color={uiState.theme.text.secondary}>
                  ▼ Scroll down for more
                </Text>
              </Box>
            </>
          )}
        </Box>

        {/* Right column: Settings editor (70%) */}
        <Box 
          flexDirection="column" 
          width="70%" 
          borderStyle="single" 
          borderColor={focusedColumn === 'right' && hasFocus ? uiState.theme.border.active : uiState.theme.border.primary} 
          paddingX={2}
          paddingY={1}
        >
          {currentSection ? (
            <>
              {/* Section title and scroll up indicator */}
              <Box paddingLeft={1} justifyContent="space-between" width="100%">
                <Text bold color="yellow">
                  {currentSection.id === 'model' ? 'Selected LLM Model' : currentSection.name}
                </Text>
                {rightScrollOffset > 0 && (
                  <Box marginRight={1}>
                    <Text color={uiState.theme.text.secondary}>▲ More</Text>
                  </Box>
                )}
              </Box>

              <Text> </Text>

              {/* Settings list - Flex grow to fill space */}
              <Box flexDirection="column" flexGrow={1}>
                {currentSettings.slice(rightScrollOffset, rightScrollOffset + WINDOW_SIZE).map((setting, sliceIdx) => {
                  const idx = sliceIdx + rightScrollOffset;
                  const isSelected = focusedColumn === 'right' && idx === selectedSettingIndex;
                  const isEditing = isEditingValue && isSelected;
                  const prevSetting = idx > 0 ? currentSettings[idx - 1] : null;

                  if ((setting as any).type === 'header') {
                    return (
                      <Box key={`header-${idx}`} marginTop={1} paddingLeft={1}>
                        <Text bold color={(setting as any).muted ? uiState.theme.text.secondary : "yellow"} dimColor={(setting as any).muted}>
                          {setting.label}
                        </Text>
                      </Box>
                    );
                  }

                  if ((setting as any).type === 'info') {
                     return (
                      <Box key={`info-${idx}`} marginTop={idx > 0 && (currentSettings[idx-1] as any).type !== 'header' ? 1 : 0} paddingLeft={1}>
                        <Box width="30%">
                          <Text 
                            color={(setting as any).muted ? uiState.theme.text.secondary : uiState.theme.text.secondary} 
                            dimColor={(setting as any).muted}
                          >
                            {setting.label}{setting.label ? ':' : ''}
                          </Text>
                        </Box>
                        <Box flexGrow={1} flexShrink={1}>
                          <Text 
                            color={((setting as any).muted || (setting as any).muted_value) ? uiState.theme.text.secondary : uiState.theme.text.primary} 
                            wrap="wrap" 
                            dimColor={(setting as any).muted || (setting as any).muted_value}
                          >
                            {String(setting.value)}
                          </Text>
                        </Box>
                      </Box>
                    );
                  }

                  // Determine if we should add marginTop
                  const isCompactChoice = (setting as any).type === 'choice' && prevSetting && (prevSetting as any).type === 'choice';
                  const marginTop = (idx > 0 && (prevSetting as any).type !== 'header' && !isCompactChoice) ? 1 : 0;

                  return (
                    <Box key={`${setting.id}-${idx}`} marginTop={marginTop} paddingLeft={1}>
                      {(setting as any).type === 'choice' ? (
                        <Box>
                          <Text
                            bold={isSelected && hasFocus}
                            color={(setting as any).muted ? uiState.theme.text.secondary : (isSelected && hasFocus ? 'yellow' : uiState.theme.text.primary)}
                            dimColor={(setting as any).muted}
                          >
                            {(setting as any).active ? '●' : '○'} {setting.label}
                          </Text>
                        </Box>
                      ) : (
                        <>
                          <Box width="40%">
                            <Text
                              bold={isSelected && hasFocus}
                              color={(setting as any).muted ? uiState.theme.text.secondary : (isSelected && hasFocus ? 'yellow' : uiState.theme.text.primary)}
                              dimColor={(setting as any).muted}
                            >
                              {setting.label}:
                            </Text>
                          </Box>
                          <Box>
                            {isEditing ? (
                              <Text color="yellow">
                                [{editValue}_] <Text dimColor>↵ Save Esc Cancel</Text>
                              </Text>
                            ) : (
                              <Text color={(setting as any).muted ? uiState.theme.text.secondary : uiState.theme.text.primary} dimColor={(setting as any).muted}>
                                {setting.type === 'toggle' 
                                  ? (setting.value ? '✓ Enabled' : '✗ Disabled')
                                  : String(setting.value)
                                }
                              </Text>
                            )}
                          </Box>
                        </>
                      )}
                    </Box>
                  );
                })}
              </Box>

              {/* Scroll indicator at bottom right - pushed down by flexGrow above */}
              <Box justifyContent="flex-end" width="100%">
                {rightScrollOffset + WINDOW_SIZE < currentSettings.length ? (
                  <Box marginRight={1}>
                    <Text color={uiState.theme.text.secondary}>▼ More</Text>
                  </Box>
                ) : (
                  <Box height={1} /> // Spacer to keep layout stable
                )}
              </Box>
            </>
          ) : (
            <Text color={uiState.theme.text.secondary}>
              Select a section to view settings
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
}
