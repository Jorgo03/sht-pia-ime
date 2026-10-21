// Types for deviceState.js, so the phone app (TypeScript) can import it.
export type DeviceNotificationState =
  | 'web'
  | 'unavailable'
  | 'checking'
  | 'off'
  | 'blocked'
  | 'registering'
  | 'registerFailed'
  | 'on';

export interface DevicePermission {
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
}

export function deviceState(input: {
  platform: 'ios' | 'android' | 'web';
  remoteSupported: boolean;
  permission: DevicePermission | null;
  registration: 'registered' | 'failed' | null;
}): DeviceNotificationState;
export function canReceive(state: DeviceNotificationState): boolean;
export function canTurnOn(state: DeviceNotificationState): boolean;
export function createLatestSaver<T>(save: (value: T) => Promise<boolean>): (value: T) => Promise<{ ok: boolean; value: T }>;
