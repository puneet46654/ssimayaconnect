import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseCountries, countryForTimeZone, INDIA_FALLBACK } from '../../lib/country-defaults';

const countries = [INDIA_FALLBACK,
  { name: 'United States', iso2: 'US', callingCode: '+1', flag: 'US' },
  { name: 'Canada', iso2: 'CA', callingCode: '+1', flag: 'CA' },
  { name: 'United Kingdom', iso2: 'GB', callingCode: '+44', flag: 'GB' },
];
test('timezone country defaults cover global zones and legacy aliases without offset guessing', () => {
  for (const [zone, code] of Object.entries({ 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'America/New_York': 'US',
    'America/Toronto': 'CA', 'Europe/London': 'GB', 'Europe/Paris': 'FR', 'Africa/Nairobi': 'KE',
    'Pacific/Auckland': 'NZ', 'Australia/Sydney': 'AU', 'Asia/Katmandu': 'NP', UTC: 'IN', 'Etc/GMT+5': 'IN', invalid: 'IN' })) {
    assert.equal(countryForTimeZone(zone), code, zone);
  }
});
test('country and phone choices restore independently and override device defaults', () => {
  const automatic = chooseCountries(countries, {}, 'America/New_York');
  assert.equal(automatic.residence.iso2, 'US'); assert.equal(automatic.phone.iso2, 'US');
  const manual = chooseCountries(countries, { countryIso2: 'US', phoneCountry: 'GB', countryCode: '+44' }, 'Asia/Kolkata');
  assert.equal(manual.residence.iso2, 'US'); assert.equal(manual.phone.iso2, 'GB');
  const sharedCode = chooseCountries(countries, { countryIso2: 'US', phoneCountry: 'CA', countryCode: '+1' }, 'Asia/Kolkata');
  assert.equal(sharedCode.phone.iso2, 'CA');
  assert.equal(chooseCountries(countries, {}, 'UTC').residence.iso2, 'IN');
});
