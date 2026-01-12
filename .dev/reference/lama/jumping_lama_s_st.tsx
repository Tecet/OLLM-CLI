
import React from 'react';
import { render, Box, Text } from 'ink';
import { LlamaAnimation } from '../../packages/cli/src/components/LlamaAnimation';

// TEST 1: Small & Standard Sizes
// High-Density Rendering (Half-Block) verification
const TestSmallStandard = () => {
    return (
        <Box flexDirection="column" gap={1} padding={2}>
            <Text bold underline>High-Density Animation Test (Small & Standard)</Text>
            
            <Box flexDirection="column" borderStyle="round" borderColor="green" title="Small (High Density)">
                <Text color="gray">Size: "small" | 12 lines | 24px effective res</Text>
                <LlamaAnimation size="small" />
            </Box>

            <Box flexDirection="column" borderStyle="double" borderColor="blue" title="Standard (High Density)">
                <Text color="gray">Size: "standard" | 24 lines | 48px effective res (Native!)</Text>
                <LlamaAnimation size="standard" />
            </Box>
        </Box>
    );
};

render(<TestSmallStandard />);
