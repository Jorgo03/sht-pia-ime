import DateTimePicker from '@react-native-community/datetimepicker';

import type { ViewingTimePickerProps } from './viewing-time-picker.types';

/** Date and time for a viewing request: the platform's own spinner. See
 *  viewing-time-picker.web.tsx for the website, where this module draws
 *  nothing. */
export function ViewingTimePicker({ value, minimumDate, onChange }: ViewingTimePickerProps) {
  return (
    <DateTimePicker
      value={value}
      mode="datetime"
      display="spinner"
      minimumDate={minimumDate}
      onChange={(_event, date) => date && onChange(date)}
      themeVariant="dark"
    />
  );
}
