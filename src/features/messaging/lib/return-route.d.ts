// Types for return-route.js, so the phone app (TypeScript) can import it.
export type MessagesReturnToken = 'home' | 'search' | 'profile' | 'agent';
export const MESSAGES_RETURN_TOKEN: {
  readonly HOME: 'home';
  readonly SEARCH: 'search';
  readonly PROFILE: 'profile';
  readonly AGENT: 'agent';
};
export const MESSAGES_RETURN_TOKENS: readonly MessagesReturnToken[];
export const MESSAGES_RETURN_FALLBACK: string;
export function isMessagesReturnToken(value: unknown): value is MessagesReturnToken;
export function tokenForTab(tabName: string | null | undefined): MessagesReturnToken;
export function returnRouteForToken(token: string | null | undefined): string;
export function parseReturnToken(
  param: string | string[] | null | undefined,
): MessagesReturnToken | null;
export function buildInboxHref(token?: string | null): string;
export function buildThreadHref(conversationId: string, token?: string | null): string;
export function resolveGoBackAction(args: {
  canGoBack: boolean;
  from?: string | string[] | null;
}): { kind: 'back'; token: MessagesReturnToken | null } | { kind: 'replace'; token: MessagesReturnToken | null; href: string };
