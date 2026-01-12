
import React from 'react';
import { render, Box, Text } from 'ink';
import { LlamaAnimation } from '../../packages/cli/src/components/LlamaAnimation';

const TestStandard = () => {
    return (
        <Box flexDirection="column" gap={1} padding={2}>
            <Text bold underline>High-Density Animation Test (Standard)</Text>

            <Box flexDirection="column" borderStyle="double" borderColor="blue" title="Standard (High Density)">
                <Text color="gray">Size: "standard" | 24 lines | 48px effective res (Native!)</Text>
                <LlamaAnimation size="standard" />
            </Box>
        </Box>
    );
};

render(<TestStandard />);
