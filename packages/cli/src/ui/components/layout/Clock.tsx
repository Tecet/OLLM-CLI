import React, { useState, useEffect } from 'react';
import { Box, Text, BoxProps } from 'ink';

import { useUI } from '../../../features/context/UIContext.js';

interface ClockProps {
  borderColor?: string;
}

export function Clock({ borderColor }: ClockProps) {
  const [time, setTime] = useState(new Date());
  const { state: uiState } = useUI();
  const { theme } = uiState;

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = time.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return (
    <Box
      borderStyle={theme.border.style as BoxProps['borderStyle']}
      borderColor={borderColor || theme.border.primary}
      paddingX={1}
    >
      <Text color="greenBright" bold>
        {timeString}
      </Text>
    </Box>
  );
}
