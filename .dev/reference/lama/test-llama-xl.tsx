
import React from 'react';
import { render, Box, Text } from 'ink';
import { LlamaAnimation } from '../../packages/cli/src/components/LlamaAnimation';

// Dedicated test for the Extra Large (96px) Llama
// This requires a very tall terminal window or fullscreen mode
const GiantTest = () => {
    return (
        <Box flexDirection="column" alignItems="center" justifyContent="center">
            <Text bold color="cyan">=== EXTRA LARGE MODE (96px) ===</Text>
            <Box borderStyle="bold" borderColor="cyan" padding={1}>
                <LlamaAnimation size="xlarge" />
            </Box>
            <Text color="gray">If this flickers, increase your terminal height!</Text>
        </Box>
    );
};

render(<GiantTest />);
