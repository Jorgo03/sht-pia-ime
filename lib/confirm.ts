import { Alert, Platform } from 'react-native';

/**
 * Asks before doing something, on every platform.
 *
 * react-native-web's Alert.alert is an empty function, so a dialog built on it
 * never appears in the web build and its action never runs: deleting a listing
 * or blocking someone silently did nothing there. Phones keep the native
 * dialog; the web gets the browser's own confirm box.
 */
export function confirmAction({
  title,
  message,
  confirmText,
  cancelText,
  destructive = false,
  onConfirm,
}: {
  title: string;
  message?: string;
  confirmText: string;
  cancelText: string;
  destructive?: boolean;
  onConfirm: () => void;
}): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm([title, message].filter(Boolean).join('\n\n'))) onConfirm();
    return;
  }
  Alert.alert(title, message ?? '', [
    { text: cancelText, style: 'cancel' },
    { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
