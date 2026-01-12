
import React from 'react';
import { render, Box, Text } from 'ink';
import { LlamaAnimation } from '../../packages/cli/src/components/LlamaAnimation';

// TEST 3: Extra Large Size
const TestExtraLarge = () => {
    return (
        <Box flexDirection="column" gap={1} padding={2}>
            <Text bold underline>High-Density Animation Test (Extra Large)</Text>
            
            <Box flexDirection="column" borderStyle="bold" borderColor="cyan" title="Extra Large (High Density)">
                <Text color="gray">Size: "xlarge" | 96 lines | 192px effective res (4x Zoom)</Text>
                <LlamaAnimation size="xlarge" />
            </Box>
        </Box>
    );
};

render(<TestExtraLarge />);
