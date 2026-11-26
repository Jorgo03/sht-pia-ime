// Website switches for whole features. The phone app keeps its own switch
// (constants/features.ts); the owner turned these on for the website on
// 2026-11-26.

/** The AI assistant page, its Home and Search entries and "Ask about this home". */
export const AI_CHAT_ENABLED = true

/** Buying a plan stays off until the payment backend is live (DECISIONS.md M1). */
export const CHECKOUT_ENABLED = import.meta.env.EXPO_PUBLIC_CHECKOUT_ENABLED === 'true'
