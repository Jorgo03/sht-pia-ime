import DateTimePicker from '@react-native-community/datetimepicker';

import { localWallAsTirana, tiranaWallAsLocal } from '@/src/lib/tiranaTime';

import type { ViewingTimePickerProps } from './viewing-time-picker.types';

/** Date and time for a viewing request: the platform's own spinner. See
 *  viewing-time-picker.web.tsx for the website, where this module draws
 *  nothing.
 *
 *  The wheel works in the phone's own time zone, but a viewing's time is
 *  Tirana time (AUDIT-005): it is shown as Tirana's clock and what the person
 *  picks is read back as Tirana time. `value` and `onChange` are real instants. */
export function ViewingTimePicker({ value, minimumDate, onChange }: ViewingTimePickerProps) {
  return (
    <DateTimePicker
      value={tiranaWallAsLocal(value)}
      mode="datetime"
      display="spinner"
      minimumDate={tiranaWallAsLocal(minimumDate)}
      onChange={(_event, date) => date && onChange(localWallAsTirana(date))}
      themeVariant="dark"
    />
  );
}
