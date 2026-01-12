
import React from 'react';
import { render, Box, Text } from 'ink';
import { LlamaAnimation } from '../../packages/cli/src/components/LlamaAnimation';

const TestXSmall = () => {
    return (
        <Box flexDirection="column" gap={1} padding={2}>
            <Text bold underline>High-Density Animation Test (Extra Small)</Text>
            
            <Box flexDirection="column" borderStyle="round" borderColor="yellow" title="XSmall (High Density)">
                <Text color="gray">Size: "xsmall" | 7 lines | 14px effective res</Text>
                <LlamaAnimation size="xsmall" />
            </Box>
        </Box>
    );
};

render(<TestXSmall />);
