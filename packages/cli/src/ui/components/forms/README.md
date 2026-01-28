# Form Components

Shared form components for building dialogs and forms in the MCP Panel UI.

## Components

### FormField

Wrapper component for form fields with label, help text, and error display.

**Props:**

- `label` (string, required): Field label
- `error` (string, optional): Error message to display
- `required` (boolean, optional): Show required indicator (\*)
- `helpText` (string, optional): Help text (hidden when error is present)
- `children` (ReactNode, required): Input component(s)

**Example:**

```tsx
<FormField label="Server Name" required error={errors.name}>
  <TextInput value={name} onChange={setName} />
</FormField>
```

### TextInput

Text input component with validation and masking support.

**Props:**

- `value` (string, required): Current value
- `onChange` (function, required): Change handler
- `placeholder` (string, optional): Placeholder text
- `mask` (boolean, optional): Mask value for sensitive data
- `disabled` (boolean, optional): Disable input
- `maxLength` (number, optional): Maximum length (truncates with ...)
- `validate` (function, optional): Validation function

**Example:**

```tsx
<TextInput
  value={apiKey}
  onChange={setApiKey}
  placeholder="Enter API key"
  mask={true}
  validate={validators.required}
/>
```

**Built-in Validators:**

- `validators.required` - Field is required
- `validators.minLength(n)` - Minimum length
- `validators.maxLength(n)` - Maximum length
- `validators.pattern(regex, message)` - Pattern matching
- `validators.url` - Valid URL
- `validators.email` - Valid email
- `validators.number` - Valid number
- `validators.integer` - Valid integer
- `validators.positive` - Positive number

**Combining Validators:**

```tsx
const validate = combineValidators(
  validators.required,
  validators.minLength(3),
  validators.maxLength(50)
);
```

### Checkbox

Checkbox component with label and description.

**Props:**

- `label` (string, required): Checkbox label
- `checked` (boolean, required): Checked state
- `onChange` (function, required): Change handler
- `disabled` (boolean, optional): Disable checkbox
- `description` (string, optional): Description text

**Example:**

```tsx
<Checkbox
  label="Auto-approve all tools"
  checked={autoApprove}
  onChange={setAutoApprove}
  description="Automatically approve all tool calls"
/>
```

### CheckboxGroup

Group of related checkboxes.

**Props:**

- `label` (string, required): Group label
- `options` (array, required): Array of options with value, label, description
- `selected` (string[], required): Array of selected values
- `onChange` (function, required): Change handler
- `disabled` (boolean, optional): Disable all checkboxes

**Example:**

```tsx
<CheckboxGroup
  label="OAuth Scopes"
  options={[
    { value: 'read', label: 'Read', description: 'Read access' },
    { value: 'write', label: 'Write', description: 'Write access' },
  ]}
  selected={selectedScopes}
  onChange={setSelectedScopes}
/>
```

### Button

Button component with variants and states.

**Props:**

- `label` (string, required): Button label
- `onPress` (function, required): Press handler
- `disabled` (boolean, optional): Disable button
- `loading` (boolean, optional): Show loading state
- `variant` (string, optional): 'primary' | 'secondary' | 'danger' | 'success'
- `shortcut` (string, optional): Keyboard shortcut to display
- `icon` (string, optional): Icon to display

**Example:**

```tsx
<Button
  label="Save"
  onPress={handleSave}
  variant="primary"
  shortcut="S"
  icon="💾"
  loading={isSaving}
/>
```

### ButtonGroup

Group of related buttons with consistent spacing.

**Props:**

- `buttons` (array, required): Array of button props
- `spacing` (number, optional): Gap between buttons (default: 2)

**Example:**

```tsx
<ButtonGroup
  buttons={[
    { label: 'Save', onPress: handleSave, shortcut: 'S', variant: 'primary' },
    { label: 'Cancel', onPress: handleCancel, shortcut: 'C', variant: 'secondary' },
  ]}
/>
```

### IconButton

Button with only an icon.

**Props:**

- `icon` (string, required): Icon to display
- `onPress` (function, required): Press handler
- `disabled` (boolean, optional): Disable button
- `loading` (boolean, optional): Show loading state
- `tooltip` (string, optional): Tooltip text
- `variant` (string, optional): 'primary' | 'secondary' | 'danger' | 'success'

**Example:**

```tsx
<IconButton icon="✓" onPress={handleConfirm} tooltip="Confirm" variant="success" />
```

## Styling

All components use the theme from `UIContext` for consistent styling:

- **Text colors**: `theme.text.primary`, `theme.text.secondary`
- **Status colors**: `theme.status.success`, `theme.status.error`, `theme.status.info`
- **Border colors**: `theme.border.primary`, `theme.border.active`

## Validation

Form validation is handled through the `validate` prop on `TextInput` and displayed by `FormField`:

```tsx
<FormField label="Email" error={emailError}>
  <TextInput value={email} onChange={setEmail} validate={validators.email} />
</FormField>
```

## Accessibility

- All components support keyboard navigation
- Visual feedback for all states (disabled, loading, error)
- Clear error messages with ⚠ icon
- Required fields marked with \* indicator
- Help text provides context

## Testing

All components have comprehensive test coverage:

- `FormField.test.tsx` - Label, error, help text rendering
- `TextInput.test.tsx` - Value display, masking, validation
- `Checkbox.test.tsx` - Checked state, groups
- `Button.test.tsx` - Variants, states, groups

Run tests:

```bash
npm test -- packages/cli/src/ui/components/forms/__tests__ --run
```

## Requirements Validation

These components validate the following requirements:

- **NFR-7**: Visual feedback for all user actions
- **NFR-9**: Help text available for all dialogs
- **NFR-16**: Environment variables with secrets masked in UI

## Future Enhancements

- Select/dropdown component
- Radio button component
- Textarea component
- Date/time picker
- File upload component
- Color picker
- Slider component
