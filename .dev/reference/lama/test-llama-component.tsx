
import React from 'react';
import { render, Box, Text } from 'ink';
// Import directly from the component source to verify integration
import { LlamaAnimation } from '../../packages/cli/src/components/LlamaAnimation';

const IntegrationTest = () => {
    return (
        <Box flexDirection="column" gap={1} padding={2}>
            <Text bold underline>LlamaAnimation Component Integration Test</Text>
            
            <Box flexDirection="column" borderStyle="round" borderColor="green" title="Small (12px)">
                <Text color="gray">Size: "small" | Inside Border</Text>
                <LlamaAnimation size="small" />
            </Box>

            <Box flexDirection="column" borderStyle="double" borderColor="blue" title="Standard (24px)">
                <Text color="gray">Size: "standard" | Inside Double Border</Text>
                <LlamaAnimation size="standard" />
            </Box>

            <Box flexDirection="column" borderStyle="round" borderColor="magenta" title="Large (48px)">
                <Text color="gray">Size: "large" | Native 1:1</Text>
                <LlamaAnimation size="large" />
            </Box>
        </Box>
    );
};

render(<IntegrationTest />);
