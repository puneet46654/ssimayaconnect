'use client';

import {
  RefObject,
  useEffect,
  useRef,
} from 'react';

type DraftField = {
  value: string;
  checked?: boolean;
  type: string;
};

type DraftValues = Record<
  string,
  DraftField | DraftField[]
>;

function readForm(form: HTMLFormElement) {
  const values: DraftValues = {};

  form
    .querySelectorAll<
      HTMLInputElement |
        HTMLSelectElement |
        HTMLTextAreaElement
    >('[name]')
    .forEach((field) => {
      if (
        field instanceof HTMLInputElement &&
        field.type === 'file'
      ) {
        return;
      }

      const value: DraftField = {
        value: field.value,
        type:
          field instanceof HTMLInputElement
            ? field.type
            : 'text',
      };

      if (
        field instanceof HTMLInputElement &&
        (field.type === 'checkbox' ||
          field.type === 'radio')
      ) {
        value.checked = field.checked;
      }

      const existing = values[field.name];

      if (existing) {
        values[field.name] = Array.isArray(existing)
          ? [...existing, value]
          : [existing, value];
      } else {
        values[field.name] = value;
      }
    });

  return values;
}

function restoreForm(
  form: HTMLFormElement,
  values: DraftValues,
) {
  Object.entries(values).forEach(
    ([name, saved]) => {
      const fields = Array.from(
        form.elements.namedItem(name) instanceof RadioNodeList
          ? form.elements.namedItem(name) as RadioNodeList
          : [form.elements.namedItem(name)],
      ).filter(
        (
          field,
        ): field is
          | HTMLInputElement
          | HTMLSelectElement
          | HTMLTextAreaElement =>
          field instanceof HTMLInputElement ||
          field instanceof HTMLSelectElement ||
          field instanceof HTMLTextAreaElement,
      );

      const savedFields = Array.isArray(saved)
        ? saved
        : [saved];

      fields.forEach((field, index) => {
        const next = savedFields[index];

        if (!next) {
          return;
        }

        if (
          field instanceof HTMLInputElement &&
          (field.type === 'checkbox' ||
            field.type === 'radio')
        ) {
          field.checked = Boolean(next.checked);
        } else {
          field.value = next.value;
        }

        field.dispatchEvent(
          new Event('input', {
            bubbles: true,
          }),
        );
        field.dispatchEvent(
          new Event('change', {
            bubbles: true,
          }),
        );
      });
    },
  );
}

export function useFormDraft(
  key: string,
  formRef: RefObject<HTMLFormElement | null>,
) {
  const restoredRef = useRef(false);

  useEffect(() => {
    const form = formRef.current;

    if (!form || !key) {
      return;
    }

    const restore = () => {
      if (restoredRef.current) {
        return;
      }

      restoredRef.current = true;

      try {
        const raw =
          window.sessionStorage.getItem(key);

        if (raw) {
          restoreForm(
            form,
            JSON.parse(raw) as DraftValues,
          );
        }
      } catch (error) {
        console.error(
          'Unable to restore form draft:',
          error,
        );
      }
    };

    const save = () => {
      try {
        window.sessionStorage.setItem(
          key,
          JSON.stringify(readForm(form)),
        );
      } catch (error) {
        console.error(
          'Unable to save form draft:',
          error,
        );
      }
    };

    const frame = window.requestAnimationFrame(
      restore,
    );

    form.addEventListener('input', save);
    form.addEventListener('change', save);

    return () => {
      window.cancelAnimationFrame(frame);
      form.removeEventListener('input', save);
      form.removeEventListener('change', save);
    };
  }, [formRef, key]);
}
