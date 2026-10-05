'use client';

import { useEffect, useId, useState } from 'react';
import { DEFAULT_TIME_ZONE, deviceTimeZone } from '@/lib/events/dates';

export default function TimeZoneSelect({ value, onChange, autoDetect = false, className = '', hint = 'Dates and times use this timezone. Change it if the venue is elsewhere.' }: {
  value: string; onChange: (value: string) => void; autoDetect?: boolean; className?: string; hint?: string;
}) {
  const id = useId();
  const [zones] = useState(() => Array.from(new Set([
    DEFAULT_TIME_ZONE, 'UTC', value, ...Intl.supportedValuesOf('timeZone'),
  ])).sort());
  useEffect(() => {
    if (autoDetect && !value) onChange(deviceTimeZone());
  }, [autoDetect, value, onChange]);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">Timezone</label>
      <select id={id} name="timeZone" value={value || DEFAULT_TIME_ZONE} onChange={event => onChange(event.target.value)} className={className}>
        {Array.from(new Set([...zones, value].filter(Boolean))).map(zone => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}
      </select>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
  );
}
