import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

interface ClockProps {
  borderColor?: string;
}

export function Clock({ borderColor = 'yellow' }: ClockProps) {
  const [time, setTime] = useState(new Date());

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
    hour12: false 
  });

  return (
    <Box borderStyle="single" borderColor={borderColor} paddingX={1}>
      <Text color="greenBright" bold>
        {timeString}
      </Text>
    </Box>
  );
}
