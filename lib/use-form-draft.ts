'use client';
import { useEffect, type RefObject } from 'react';
import { readBookingDraft } from './booking-draft';

// Controlled location selectors persist through useBookingCountries instead.
const LOCATION_FIELDS = new Set(['country', 'countryIso2', 'countryCode', 'phoneCountry', 'state']);
export function useFormDraft(key: string, formRef: RefObject<HTMLFormElement | null>, eventId: string) {
  useEffect(() => {
    const form = formRef.current;
    if (!form || !key) return;
    let restored = false;
    const fields = () => Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[name]'))
      .filter(field => !LOCATION_FIELDS.has(field.name) && field.type !== 'file' && field.type !== 'hidden');
    const restore = window.requestAnimationFrame(() => {
      const values = readBookingDraft(eventId);
      for (const field of fields()) {
        if (values[field.name] !== undefined) field.value = values[field.name];
      }
      restored = true;
    });
    const save = () => {
      if (!restored) return;
      try { sessionStorage.setItem(key, JSON.stringify(Object.fromEntries(fields().map(field => [field.name, field.value])))); }
      catch { /* Keep the current form usable when browser storage is unavailable. */ }
    };
    form.addEventListener('input', save); form.addEventListener('change', save);
    return () => { window.cancelAnimationFrame(restore); form.removeEventListener('input', save); form.removeEventListener('change', save); };
  }, [key, formRef, eventId]);
}
