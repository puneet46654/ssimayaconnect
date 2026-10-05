'use client';

import { useEffect, useState } from 'react';
import { bookingStorage } from './booking-contracts';
import { readBookingDraft } from './booking-draft';
import { chooseCountries, INDIA_FALLBACK, type CountryOption } from './country-defaults';

export function useBookingCountries(eventId: string) {
  const [countries, setCountries] = useState<CountryOption[]>([INDIA_FALLBACK]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState(INDIA_FALLBACK);
  const [selectedPhoneCountry, setSelectedPhoneCountry] = useState(INDIA_FALLBACK);
  const [selectedState, setSelectedState] = useState('');
  const [states, setStates] = useState<{ name: string; code: string }[]>([]);
  const [statesLoading, setStatesLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const saved = readBookingDraft(eventId);
    async function load() {
      let result = [INDIA_FALLBACK];
      try {
        const response = await fetch('/api/location/countries', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
        const data = await response.json();
        if (response.ok && data.success && Array.isArray(data.countries) && data.countries.length) result = data.countries;
      } catch { /* Keep registration usable with the fallback country. */ }
      if (controller.signal.aborted) return;
      for (const [iso, name, code] of [[saved.countryIso2, saved.country, ''], [saved.phoneCountry, saved.phoneCountry, saved.countryCode]]) {
        const existing = result.find(country => country.iso2 === iso);
        if (existing && !existing.callingCode && code) existing.callingCode = code;
        else if (iso && name && !existing) result.push({ iso2: iso, name, callingCode: code || '', flag: iso });
      }
      const { residence, phone } = chooseCountries(result, saved);
      setCountries(result); setSelectedCountry(residence); setSelectedPhoneCountry(phone);
      setSelectedState(saved.state || ''); setCountriesLoading(false);
    }
    void load();
    return () => controller.abort();
  }, [eventId]);

  useEffect(() => {
    if (countriesLoading) return;
    try { sessionStorage.setItem(bookingStorage.country(eventId), JSON.stringify({ countryIso2: selectedCountry.iso2,
      country: selectedCountry.name, phoneCountry: selectedPhoneCountry.iso2, countryCode: selectedPhoneCountry.callingCode, state: selectedState })); }
    catch { /* Browser storage is optional. */ }
  }, [eventId, countriesLoading, selectedCountry, selectedPhoneCountry, selectedState]);

  useEffect(() => {
    if (countriesLoading) return;
    const controller = new AbortController();
    async function load() {
      setStatesLoading(true); setStates([]);
      try {
        const response = await fetch(`/api/location/states?country=${encodeURIComponent(selectedCountry.name)}`,
          { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
        const data = await response.json();
        if (!controller.signal.aborted && response.ok && data.success && Array.isArray(data.states)) setStates(data.states);
      } catch { /* Allow a typed state when the list cannot be loaded. */ }
      finally { if (!controller.signal.aborted) setStatesLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [countriesLoading, selectedCountry.name]);

  function changeCountry(country: CountryOption) { setSelectedCountry(country); setSelectedState(''); }
  return { countries, countriesLoading, selectedCountry, setSelectedCountry: changeCountry,
    selectedPhoneCountry, setSelectedPhoneCountry, selectedState, setSelectedState, states, statesLoading };
}
