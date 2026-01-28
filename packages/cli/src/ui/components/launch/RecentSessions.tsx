import React from 'react';
import { Box, Text } from 'ink';

interface Session {
  id: string;
  timestamp: Date;
  messageCount: number;
}

interface RecentSessionsProps {
  sessions: Session[];
  theme: {
    text: {
      primary: string;
      secondary: string;
      accent: string;
    };
  };
}

export const RecentSessions: React.FC<RecentSessionsProps> = ({ sessions, theme }) => {
  if (sessions.length === 0) {
    return null;
  }

  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color={theme.text.accent}>
        Recent Sessions
      </Text>

      <Box flexDirection="column" paddingLeft={2}>
        {sessions.slice(0, 5).map((session) => (
          <Box key={session.id} gap={2}>
            <Text color={theme.text.primary}>• {session.id.substring(0, 8)}</Text>
            <Text dimColor color={theme.text.secondary}>
              {session.messageCount} messages
            </Text>
            <Text dimColor color={theme.text.secondary}>
              {formatTimestamp(session.timestamp)}
            </Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text dimColor color={theme.text.secondary}>
          Use <Text color={theme.text.accent}>/session resume &lt;id&gt;</Text> to continue
        </Text>
      </Box>
    </Box>
  );
};
