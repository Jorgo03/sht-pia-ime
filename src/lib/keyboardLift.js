// How far the "U krye" keyboard bar must rise so it sits on the keyboard's
// top edge (components/ui/keyboard-done-bar.tsx). Pure, for `npm test`.
//
// containerBottom: the bottom of the bar's container, in window coordinates.
// keyboardTop: the keyboard's top edge, in window coordinates.
// Inside a KeyboardAvoidingView the container already ends at the keyboard,
// so the lift is 0; a screen without one ends at the bottom of the window and
// the bar rises by the keyboard's height. Never negative, never fractional.
export function keyboardLift({ containerBottom, keyboardTop }) {
  if (!Number.isFinite(containerBottom) || !Number.isFinite(keyboardTop)) return 0
  return Math.max(0, Math.round(containerBottom - keyboardTop))
}
