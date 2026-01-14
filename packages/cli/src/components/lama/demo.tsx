import React from 'react';
import { render, Box, Text } from 'ink';
import { LlamaAnimation } from './LlamaAnimation.js';

const Layout = () => (
    <Box flexDirection="column" padding={2} gap={1}>
        <Text bold>LLama CLI Animation Demo</Text>
        <Text dimColor>Assets: packages/cli/src/components/lama/lama_sprite</Text>

        <Box flexDirection="row" gap={2} paddingTop={1}>
            <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1} width={32}>
                <Text color="cyan">Small (12 lines)</Text>
                <LlamaAnimation size="small" movementRatio={0.7} />
            </Box>
            <Box flexDirection="column" borderStyle="round" borderColor="magenta" padding={1} width={32}>
                <Text color="magenta">Standard (24 lines)</Text>
                <LlamaAnimation size="standard" movementRatio={0.7} />
            </Box>
        </Box>
        <Box marginTop={1} borderStyle="single" borderColor="gray" padding={1} width={80}>
            <Text bold>Quick Controls</Text>
            <Text dimColor>- Press Ctrl+C to exit.</Text>
        </Box>
    </Box>
);

render(<Layout />);
