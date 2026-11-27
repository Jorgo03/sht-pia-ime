// Types for listingAnswer.js, so the phone app can import it.
export function answerAboutListing(
  question: string,
  property: Record<string, unknown> | null | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
  lang?: string,
): { reply: string; contact: boolean };
