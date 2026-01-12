
import React from 'react';
import { render, Box, Text } from 'ink';
import { LlamaAnimation } from '../../packages/cli/src/components/LlamaAnimation';

const TestSmall = () => {
    return (
        <Box flexDirection="column" gap={1} padding={2}>
            <Text bold underline>High-Density Animation Test (Small)</Text>
            
            <Box flexDirection="column" borderStyle="round" borderColor="green" title="Small (High Density)">
                <Text color="gray">Size: "small" | 12 lines | 24px effective res</Text>
                <LlamaAnimation size="small" />
            </Box>
        </Box>
    );
};

render(<TestSmall />);
