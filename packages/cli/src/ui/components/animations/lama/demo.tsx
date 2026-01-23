import React from 'react';
import { render, Box, Text } from 'ink';
import { LlamaAnimation } from './LlamaAnimation.js';

const Layout = () => (
    <Box flexDirection="column" padding={1}>
        {/* Header */}
        <Box flexDirection="row">
            <Box width="15%" />
            <Box width="70%" flexDirection="column" alignItems="center" paddingY={1}>
                <Text bold color="yellow">🦙 LLama CLI Animation Demo</Text>
                <Text dimColor>Assets: packages/cli/src/components/lama/lama_sprite</Text>
            </Box>
            <Box width="15%" />
        </Box>

        {/* Small Animation Row */}
        <Box flexDirection="row" marginTop={1}>
            <Box width="15%" />
            <Box width="70%" flexDirection="column" borderStyle="round" borderColor="cyan" padding={2} minHeight={18}>
                <Text color="cyan" bold>Small Animation (12 lines)</Text>
                <Box marginTop={1} justifyContent="center">
                    <LlamaAnimation size="small" movementRatio={0.8} />
                </Box>
            </Box>
            <Box width="15%" />
        </Box>

        {/* Standard Animation Row */}
        <Box flexDirection="row" marginTop={1}>
            <Box width="15%" />
            <Box width="70%" flexDirection="column" borderStyle="round" borderColor="magenta" padding={2} minHeight={30}>
                <Text color="magenta" bold>Standard Animation (24 lines)</Text>
                <Box marginTop={1} justifyContent="center">
                    <LlamaAnimation size="standard" movementRatio={0.8} />
                </Box>
            </Box>
            <Box width="15%" />
        </Box>

        {/* Controls Row */}
        <Box flexDirection="row" marginTop={1}>
            <Box width="15%" />
            <Box width="70%" borderStyle="single" borderColor="gray" padding={1} flexDirection="column" alignItems="center">
                <Text bold>Quick Controls</Text>
                <Text dimColor>Press Ctrl+C to exit</Text>
            </Box>
            <Box width="15%" />
        </Box>
    </Box>
);

render(<Layout />);
