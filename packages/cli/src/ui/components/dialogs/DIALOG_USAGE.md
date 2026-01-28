# Dialog Component Usage Guide

The `Dialog` component is a reusable base component for creating modal dialogs in the OLLM CLI.

## Features

- ✅ Consistent border and padding
- ✅ Title display with customizable color
- ✅ Automatic Esc key handling for closing
- ✅ Theme-aware styling
- ✅ Flexible content area
- ✅ Customizable width and border color

## Basic Usage

```tsx
import { Dialog } from './components/dialogs/Dialog.js';

function MyDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="My Dialog" onClose={onClose}>
      <Box flexDirection="column">
        <Text>Dialog content goes here</Text>
        <Text>Press Esc to close</Text>
      </Box>
    </Dialog>
  );
}
```

## Props

| Prop          | Type              | Default               | Description                                 |
| ------------- | ----------------- | --------------------- | ------------------------------------------- |
| `title`       | `string`          | Required              | Dialog title displayed at the top           |
| `onClose`     | `() => void`      | Required              | Callback when dialog should close (Esc key) |
| `children`    | `React.ReactNode` | Required              | Dialog content                              |
| `width`       | `number`          | `60`                  | Dialog width in characters                  |
| `borderColor` | `string`          | `theme.border.active` | Border color                                |
| `titleColor`  | `string`          | `'yellow'`            | Title text color                            |

## Examples

### Simple Dialog

```tsx
<Dialog title="Confirmation" onClose={handleClose}>
  <Text>Are you sure you want to continue?</Text>
  <Box marginTop={1}>
    <Text>[Y] Yes [N] No</Text>
  </Box>
</Dialog>
```

### Custom Width and Colors

```tsx
<Dialog title="Error" onClose={handleClose} width={80} borderColor="red" titleColor="red">
  <Text color="red">An error occurred!</Text>
  <Text>Please try again.</Text>
</Dialog>
```

### Complex Content

```tsx
<Dialog title="Server Configuration" onClose={handleClose}>
  <Box flexDirection="column" gap={1}>
    <FormField label="Server Name">
      <TextInput value={name} onChange={setName} />
    </FormField>

    <FormField label="Port">
      <TextInput value={port} onChange={setPort} />
    </FormField>

    <Box marginTop={1} gap={2}>
      <Button label="Save" onPress={handleSave} />
      <Button label="Cancel" onPress={handleClose} />
    </Box>
  </Box>
</Dialog>
```

### With Loading State

```tsx
<Dialog title="Processing" onClose={handleClose}>
  <Box flexDirection="column" alignItems="center">
    <Spinner type="dots" />
    <Text>Please wait...</Text>
  </Box>
</Dialog>
```

## Integration with MCP Panel

The Dialog component is designed to be used in the MCP Panel UI for various dialogs:

- **ServerConfigDialog**: Configure MCP server settings
- **OAuthConfigDialog**: Manage OAuth authentication
- **InstallServerDialog**: Install servers from marketplace
- **ServerToolsViewer**: View and manage server tools
- **HealthMonitorDialog**: Monitor server health
- **ServerLogsViewer**: View server logs
- **MarketplaceDialog**: Browse marketplace servers
- **UninstallConfirmDialog**: Confirm server uninstallation

## Keyboard Handling

The Dialog component automatically handles the Esc key to close the dialog. If you need additional keyboard handling within the dialog content, use `useInput` in your child components:

```tsx
<Dialog title="My Dialog" onClose={handleClose}>
  <MyDialogContent />
</Dialog>;

function MyDialogContent() {
  useInput((input, key) => {
    if (input === 'y') {
      handleYes();
    } else if (input === 'n') {
      handleNo();
    }
  });

  return <Text>Press Y or N</Text>;
}
```

## Styling Guidelines

- Use `theme.border.active` for active/focused dialogs
- Use `theme.border.primary` for secondary dialogs
- Use `theme.status.error` for error/warning dialogs
- Keep title colors consistent: yellow for normal, red for errors, cyan for info
- Maintain consistent padding and spacing using Box margins

## Testing

The Dialog component includes comprehensive tests covering:

- Rendering with title and content
- Esc key handling
- Custom width and colors
- Theme integration
- Complex content
- Accessibility

See `__tests__/Dialog.test.tsx` for examples.

## Requirements Validation

This component validates the following requirements:

- **12.14**: Esc closes dialogs/modals
- **NFR-7**: Visual feedback for all user actions (consistent styling)
