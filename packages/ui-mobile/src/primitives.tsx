import {
  Modal,
  Pressable,
  Text as NativeText,
  TextInput,
  View,
  ActivityIndicator,
  StyleSheet,
  type TextProps,
  type TextInputProps,
  type ViewProps,
} from 'react-native';
import type { ReactNode } from 'react';
import { tokens } from '@ydown/design-tokens';
const c = tokens.colors;
export function Text({
  tone = 'primary',
  style,
  ...props
}: TextProps & { tone?: 'primary' | 'secondary' }) {
  return (
    <NativeText
      style={[
        {
          color: tone === 'secondary' ? c.textSecondary : c.textPrimary,
          fontSize: tokens.typography.body,
        },
        style,
      ]}
      {...props}
    />
  );
}
export function Button({
  children,
  onPress,
  disabled = false,
  variant = 'secondary',
  label,
}: {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  label?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor:
            variant === 'primary' ? c.accent : variant === 'ghost' ? 'transparent' : c.elevated,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: variant === 'primary' ? c.onAccent : c.textPrimary,
          fontWeight: '600',
          textAlign: 'center',
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}
export function IconButton({
  label,
  children,
  onPress,
  disabled = false,
  selected,
}: {
  label: string;
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.icon, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}
    >
      <Text style={{ color: selected ? c.accent : c.textPrimary, fontSize: 22 }}>{children}</Text>
    </Pressable>
  );
}
export function Input({ label, style, ...props }: TextInputProps & { label: string }) {
  return (
    <TextInput
      accessibilityLabel={label}
      placeholderTextColor={c.textSecondary}
      style={[s.input, style]}
      {...props}
    />
  );
}
export function Surface({ style, ...props }: ViewProps) {
  return <View style={[s.surface, style]} {...props} />;
}
export function Badge({ children }: { children: ReactNode }) {
  return (
    <View style={s.badge}>
      <Text style={{ color: c.accent, fontSize: 12 }}>{children}</Text>
    </View>
  );
}
export function Progress({ value, label }: { value: number; label: string }) {
  const ratio = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
      style={s.progress}
    >
      <View
        style={{ width: `${ratio * 100}%`, height: 6, backgroundColor: c.accent, borderRadius: 3 }}
      />
    </View>
  );
}
export function Loading({ label }: { label: string }) {
  return (
    <View accessibilityLiveRegion="polite" style={s.surface}>
      <ActivityIndicator color={c.accent} />
      <Text>{label}</Text>
    </View>
  );
}
export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View accessibilityViewIsModal style={s.dialog}>
          <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: '600' }}>
            {title}
          </Text>
          {children}
          <Button onPress={onClose}>Fechar</Button>
        </View>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: tokens.radius.sm,
    justifyContent: 'center',
  },
  icon: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  input: {
    minHeight: 48,
    padding: 12,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    color: c.textPrimary,
    fontSize: 16,
  },
  surface: {
    padding: 16,
    gap: 12,
    backgroundColor: c.surface,
    borderRadius: tokens.radius.md,
    borderColor: c.border,
    borderWidth: 1,
  },
  badge: {
    backgroundColor: c.elevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.radius.sm,
    alignSelf: 'flex-start',
  },
  progress: { height: 6, backgroundColor: c.border, borderRadius: 3, overflow: 'hidden' },
  overlay: { flex: 1, backgroundColor: '#000a', justifyContent: 'center', padding: 24 },
  dialog: { padding: 24, gap: 20, backgroundColor: c.surface, borderRadius: tokens.radius.lg },
});
