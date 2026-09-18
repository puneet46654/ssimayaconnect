'use client';

import {
  BOOKING_TEMPLATES,
  BookingFormTemplate,
} from './types';

interface BookingTemplateSelectorProps {
  value: BookingFormTemplate;
  onChange: (
    value: BookingFormTemplate,
  ) => void;
}

export default function BookingTemplateSelector({
  value,
  onChange,
}: BookingTemplateSelectorProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-secondary">
          Registration Form
          <span className="ml-1 text-red-500">
            *
          </span>
        </label>

        <p className="mt-1 text-xs leading-5 text-gray-500">
          Select which form the attendee will complete
          while booking this event.
        </p>
      </div>

      <div className="grid gap-2">
        {BOOKING_TEMPLATES.map(
          (template, index) => {
            const selected =
              value === template.id;

            return (
              <button
                key={template.id}
                type="button"
                disabled={
                  !template.available
                }
                onClick={() => {
                  if (
                    template.available
                  ) {
                    onChange(
                      template.id,
                    );
                  }
                }}
                className={`
                  group
                  flex
                  w-full
                  items-center
                  gap-3
                  rounded-xl
                  border
                  px-3.5
                  py-3
                  text-left
                  transition-all
                  duration-200

                  ${
                    selected
                      ? `
                        border-primary
                        bg-primary/[0.055]
                        shadow-[0_0_0_2px_rgba(26,158,143,0.07)]
                      `
                      : `
                        border-gray-200
                        bg-white
                      `
                  }

                  ${
                    template.available
                      ? `
                        cursor-pointer
                        hover:border-primary/40
                        hover:bg-primary/[0.025]
                      `
                      : `
                        cursor-not-allowed
                        opacity-55
                      `
                  }
                `}
              >
                <div
                  className={`
                    grid
                    h-9
                    w-9
                    shrink-0
                    place-items-center
                    rounded-lg
                    border
                    text-xs
                    font-bold
                    transition-all

                    ${
                      selected
                        ? `
                          border-primary
                          bg-primary
                          text-white
                        `
                        : `
                          border-gray-200
                          bg-gray-50
                          text-gray-500
                        `
                    }
                  `}
                >
                  {index + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={`
                        text-sm
                        font-semibold

                        ${
                          selected
                            ? 'text-primary'
                            : 'text-secondary'
                        }
                      `}
                    >
                      {template.name}
                    </p>

                    {template.available ? (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-green-700">
                        Available
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-500">
                        Coming Later
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-[11px] leading-4 text-gray-500">
                    {
                      template.description
                    }
                  </p>
                </div>

                <div
                  className={`
                    grid
                    h-5
                    w-5
                    shrink-0
                    place-items-center
                    rounded-full
                    border
                    transition-all

                    ${
                      selected
                        ? 'border-primary'
                        : 'border-gray-300'
                    }
                  `}
                >
                  {selected && (
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  )}
                </div>
              </button>
            );
          },
        )}
      </div>
    </div>
  );
}