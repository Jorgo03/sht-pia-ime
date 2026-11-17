/**
 * For a listing card that also holds a heart button. The card itself is not
 * a control for screen readers or the keyboard (otherwise the heart is a
 * button inside a button, which the web flags and iOS VoiceOver cannot even
 * reach). Its title is the link and the heart is its own button, the way the
 * website's cards work. Tapping anywhere on the card still opens it.
 */
export const CARD_CONTAINER_A11Y = { accessible: false, tabIndex: -1 } as const;
