
import React from 'react';
import { render, Box, Text } from 'ink';
import { LlamaAnimation } from '../../packages/cli/src/components/LlamaAnimation';

// TEST 2: Large Size
const TestLarge = () => {
    return (
        <Box flexDirection="column" gap={1} padding={2}>
            <Text bold underline>High-Density Animation Test (Large)</Text>
            
            <Box flexDirection="column" borderStyle="round" borderColor="magenta" title="Large (High Density)">
                <Text color="gray">Size: "large" | 48 lines | 96px effective res (2x Zoom)</Text>
                <LlamaAnimation size="large" />
            </Box>
        </Box>
    );
};

render(<TestLarge />);
