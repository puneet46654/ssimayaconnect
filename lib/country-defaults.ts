import timezoneCountries from './timezone-countries.json';
import { deviceTimeZone } from './events/dates';

// Public-domain IANA tzdb 2026e zone.tab + backward, retrieved 2026-10-01.
// https://data.iana.org/time-zones/tzdb/zone.tab
// Country-specific names are retained (zone1970.tab can combine several countries).
// These are editable defaults based on device settings, never inferred geolocation.
export function countryForTimeZone(timeZone: string): string {
  return (timezoneCountries as Record<string, string>)[timeZone] || 'IN';
}
export type CountryOption = { name: string; iso2: string; callingCode: string; flag: string };
export const INDIA_FALLBACK: CountryOption = { name: 'India', iso2: 'IN', callingCode: '+91', flag: '\u{1F1EE}\u{1F1F3}' };
export function chooseCountries(countries: CountryOption[], saved: Record<string, unknown> = {}, timeZone = deviceTimeZone()) {
  const fallback = countries.find(country => country.iso2 === countryForTimeZone(timeZone)) || INDIA_FALLBACK;
  const residence = countries.find(country => country.iso2 === saved.countryIso2 || country.name === saved.country) || fallback;
  const phone = countries.find(country => country.iso2 === saved.phoneCountry)
    || (typeof saved.countryCode === 'string' ? countries.find(country => country.callingCode === saved.countryCode && country.iso2 === residence.iso2)
      || countries.find(country => country.callingCode === saved.countryCode) : undefined) || fallback;
  return { residence, phone };
}
