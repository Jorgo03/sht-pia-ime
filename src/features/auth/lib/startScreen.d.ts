// Types for startScreen.js, so the phone app (TypeScript) can import it.
export const START_PARAM: 'start';
export function shouldStartOnSignIn(input: {
  platform: string;
  signedIn: boolean;
  pathname: string | null | undefined;
}): boolean;
export function openedAtLaunch(value: string | string[] | null | undefined): boolean;
