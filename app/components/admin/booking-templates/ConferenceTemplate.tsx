'use client';

import Image from 'next/image';

import {
  FormEvent,
  ReactNode,
  RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useRouter } from 'next/navigation';

import { trackActivity } from '@/lib/activity-client';

import { useFormDraft } from '@/lib/use-form-draft';

interface ConferenceTemplateProps {
  eventId: string;
  eventName: string;
  removeDesignationPlaceholder?: boolean;
}

type CountryOption = {
  name: string;
  iso2: string;
  callingCode: string;
  flag: string;
};

type StateOption = {
  name: string;
  code: string;
};

const INDIA_FALLBACK: CountryOption = {
  name: 'India',
  iso2: 'IN',
  callingCode: '+91',
  flag: '🇮🇳',
};

const inputClass = `
  h-12
  w-full
  min-w-0
  rounded-xl
  border
  border-gray-200
  bg-white
  px-3.5
  text-sm
  font-medium
  text-secondary
  outline-none
  transition-all
  duration-200
  placeholder:font-normal
  placeholder:text-gray-400
  hover:border-primary/35
  focus:border-primary
  focus:ring-4
  focus:ring-primary/[0.08]
  disabled:cursor-not-allowed
  disabled:bg-gray-100
  disabled:text-gray-400
`;

const labelClass = `
  mb-1.5
  block
  text-[10px]
  font-semibold
  uppercase
  tracking-[0.035em]
  text-gray-500
`;

function getCachedBookingDraft(
  eventId: string,
): Record<string, unknown> | null {
  if (
    typeof window === 'undefined' ||
    !eventId
  ) {
    return null;
  }

  try {
    const raw =
      window.sessionStorage.getItem(
        `ssi-booking-details:${eventId}`,
      );

    if (raw) {
      const parsed =
        JSON.parse(raw);

      return parsed &&
        typeof parsed === 'object'
        ? (parsed as Record<
            string,
            unknown
          >)
        : null;
    }

    const draftRaw =
      window.sessionStorage.getItem(
        `ssi-booking-draft:${eventId}`,
      );

    if (!draftRaw) {
      return null;
    }

    const draft =
      JSON.parse(draftRaw) as Record<
        string,
        unknown
      >;

    const stateField =
      draft.state;

    return {
      state:
        stateField &&
        typeof stateField === 'object' &&
        'value' in stateField
          ? stateField.value
          : '',
    };
  } catch {
    return null;
  }
}

export default function ConferenceTemplate({
  eventId,
  eventName,
  removeDesignationPlaceholder = false,
}: ConferenceTemplateProps) {
  const router = useRouter();

  const formRef =
    useRef<HTMLFormElement | null>(
      null,
    );

  useFormDraft(
    `ssi-booking-draft:${eventId}`,
    formRef,
  );

  const [submitting, setSubmitting] =
    useState(false);

  const [formError, setFormError] =
    useState('');

  const [countries, setCountries] =
    useState<CountryOption[]>([
      INDIA_FALLBACK,
    ]);

  const [
    countriesLoading,
    setCountriesLoading,
  ] = useState(true);

  const [
    selectedPhoneCountry,
    setSelectedPhoneCountry,
  ] = useState<CountryOption>(
    INDIA_FALLBACK,
  );

  const [
    selectedCountry,
    setSelectedCountry,
  ] = useState<CountryOption>(
    INDIA_FALLBACK,
  );

  const [states, setStates] =
    useState<StateOption[]>([]);

  const [
    statesLoading,
    setStatesLoading,
  ] = useState(false);

  const [
    selectedState,
    setSelectedState,
  ] = useState(() => {
    const cached =
      getCachedBookingDraft(
        eventId,
      );

    return typeof cached?.state ===
      'string'
      ? cached.state
      : '';
  });

  const [
    phoneMenuOpen,
    setPhoneMenuOpen,
  ] = useState(false);

  const [
    phoneSearch,
    setPhoneSearch,
  ] = useState('');

  const phoneMenuRef =
    useRef<HTMLDivElement>(null);

  const [
    countryMenuOpen,
    setCountryMenuOpen,
  ] = useState(false);

  const [
    countrySearch,
    setCountrySearch,
  ] = useState('');

  const countryMenuRef =
    useRef<HTMLDivElement>(null);

  /* ============================================================
     LOAD COUNTRIES
  ============================================================ */

  useEffect(() => {
    let cancelled = false;

    async function loadCountries() {
      setCountriesLoading(true);

      try {
        const response =
          await fetch(
            '/api/location/countries',
            {
              method: 'GET',
              cache: 'force-cache',
            },
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              'Unable to load countries.',
          );
        }

        if (cancelled) {
          return;
        }

        const result =
          Array.isArray(
            data.countries,
          )
            ? (data.countries as CountryOption[])
            : [];

        if (!result.length) {
          return;
        }

        const cached =
          getCachedBookingDraft(
            eventId,
          );

        const preferredCountry =
          cached &&
          typeof cached === 'object'
            ? result.find(
                (country) =>
                  country.iso2 ===
                    String(
                      cached.countryIso2 ||
                        cached.phoneCountry ||
                        '',
                    ) ||
                  country.name ===
                    String(
                      cached.country ||
                        '',
                    ),
              ) ||
              result.find(
                (country) =>
                  country.iso2 === 'IN',
              ) ||
              result[0]
            : result.find(
                (country) =>
                  country.iso2 === 'IN',
              ) || result[0];

        setCountries(result);

        if (preferredCountry) {
          setSelectedCountry(
            preferredCountry,
          );

          setSelectedPhoneCountry(
            preferredCountry,
          );
        }
      } catch (
        error: unknown
      ) {
        console.error(
          'Country loading error:',
          error,
        );
      } finally {
        if (!cancelled) {
          setCountriesLoading(
            false,
          );
        }
      }
    }

    void loadCountries();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  /* ============================================================
     LOAD STATES
  ============================================================ */

  useEffect(() => {
    let cancelled = false;

    async function loadStates() {
      setStatesLoading(true);

      setStates([]);

      const cached =
        getCachedBookingDraft(
          eventId,
        );

      const cachedCountry =
        String(
          cached?.countryIso2 ||
            cached?.phoneCountry ||
            '',
        ).toUpperCase();

      const shouldRestoreCachedState =
        typeof cached?.state ===
          'string' &&
        cached.state.trim() &&
        ((cachedCountry &&
          cachedCountry ===
            selectedCountry.iso2.toUpperCase()) ||
          (!cachedCountry &&
            String(
              cached?.country ||
                '',
            ).toLowerCase() ===
              selectedCountry.name.toLowerCase()));

      setSelectedState(
        shouldRestoreCachedState
          ? cached.state as string
          : '',
      );

      try {
        const response =
          await fetch(
            `/api/location/states?country=${encodeURIComponent(
              selectedCountry.name,
            )}`,
            {
              method: 'GET',
              cache: 'no-store',
            },
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              'Unable to load states.',
          );
        }

        if (cancelled) {
          return;
        }

        setStates(
          Array.isArray(
            data.states,
          )
            ? data.states
            : [],
        );
      } catch (
        error: unknown
      ) {
        console.error(
          'State loading error:',
          error,
        );

        if (!cancelled) {
          setStates([]);
        }
      } finally {
        if (!cancelled) {
          setStatesLoading(
            false,
          );
        }
      }
    }

    if (
      selectedCountry.name
    ) {
      void loadStates();
    }

    return () => {
      cancelled = true;
    };
  }, [eventId, selectedCountry]);

  /* ============================================================
     OUTSIDE CLICK
  ============================================================ */

  useEffect(() => {
    function handleMouseDown(
      event: MouseEvent,
    ) {
      const target =
        event.target as Node;

      if (
        phoneMenuRef.current &&
        !phoneMenuRef.current.contains(
          target,
        )
      ) {
        setPhoneMenuOpen(false);
      }

      if (
        countryMenuRef.current &&
        !countryMenuRef.current.contains(
          target,
        )
      ) {
        setCountryMenuOpen(false);
      }
    }

    document.addEventListener(
      'mousedown',
      handleMouseDown,
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleMouseDown,
      );
    };
  }, []);

  /* ============================================================
     RESTORE BOOKING DRAFT FROM CACHE
  ============================================================ */

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !eventId
    ) {
      return;
    }

    try {
      const cached =
        getCachedBookingDraft(
          eventId,
        );

      if (!cached) {
        return;
      }

      const form =
        document.querySelector<
          HTMLFormElement
        >(
          `form[data-booking-form="${eventId}"]`,
        );

      if (!form) {
        return;
      }

      const setFormValue = (
        name: string,
        value: unknown,
      ) => {
        if (
          value === undefined ||
          value === null ||
          value === ''
        ) {
          return;
        }

        const element =
          form.querySelector<
            HTMLInputElement |
              HTMLSelectElement
          >(
            `[name="${name}"]`,
          );

        if (
          element &&
          'value' in element
        ) {
          element.value =
            String(value);
        }
      };

      setFormValue(
        'designation',
        cached.designation,
      );
      setFormValue(
        'title',
        cached.title,
      );
      setFormValue(
        'fullName',
        cached.fullName,
      );
      setFormValue(
        'specialty',
        cached.specialty,
      );
      setFormValue(
        'mobile',
        cached.mobile,
      );
      setFormValue(
        'email',
        cached.email,
      );
      setFormValue(
        'hospitalName',
        cached.hospitalName,
      );
      setFormValue(
        'city',
        cached.city,
      );
    } catch (error) {
      console.error(
        'Unable to restore booking draft:',
        error,
      );
    }
  }, [
    eventId,
  ]);

  /* ============================================================
     FILTER PHONE COUNTRIES
  ============================================================ */

  const filteredPhoneCountries =
    useMemo(() => {
      const query =
        phoneSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return countries;
      }

      return countries.filter(
        (country) =>
          country.name
            .toLowerCase()
            .includes(query) ||
          country.iso2
            .toLowerCase()
            .includes(query) ||
          country.callingCode
            .toLowerCase()
            .includes(query),
      );
    }, [
      countries,
      phoneSearch,
    ]);

  /* ============================================================
     FILTER COUNTRIES
  ============================================================ */

  const filteredCountries =
    useMemo(() => {
      const query =
        countrySearch
          .trim()
          .toLowerCase();

      if (!query) {
        return countries;
      }

      return countries.filter(
        (country) =>
          country.name
            .toLowerCase()
            .includes(query) ||
          country.iso2
            .toLowerCase()
            .includes(query),
      );
    }, [
      countries,
      countrySearch,
    ]);

  /* ============================================================
     SUBMIT → TIME SLOTS
  ============================================================ */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setFormError('');

    const form =
      event.currentTarget;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data =
      new FormData(form);

    const mobile =
      String(
        data.get('mobile') || '',
      ).replace(/\D/g, '');

    if (
      mobile.length < 4 ||
      mobile.length > 14
    ) {
      setFormError(
        'Please enter a valid mobile number.',
      );

      return;
    }

    if (
      !selectedCountry.name
    ) {
      setFormError(
        'Please select a country.',
      );

      return;
    }

    if (
      states.length > 0 &&
      !selectedState
    ) {
      setFormError(
        'Please select a state or province.',
      );

      return;
    }

    setSubmitting(true);

    try {
      const bookingDetails = {
        eventId,

        eventName,

        template:
          'practitioner-institutional',

        designation:
          String(
            data.get(
              'designation',
            ) || '',
          ),

        title:
          String(
            data.get(
              'title',
            ) || '',
          ),

        fullName:
          String(
            data.get(
              'fullName',
            ) || '',
          ).trim(),

        specialty:
          String(
            data.get(
              'specialty',
            ) || '',
          ).trim(),

        mobile,

        countryCode:
          selectedPhoneCountry.callingCode,

        phoneCountry:
          selectedPhoneCountry.iso2,

        email:
          String(
            data.get(
              'email',
            ) || '',
          )
            .trim()
            .toLowerCase(),

        hospitalName:
          String(
            data.get(
              'hospitalName',
            ) || '',
          ).trim(),

        country:
          selectedCountry.name,

        countryIso2:
          selectedCountry.iso2,

        state:
          selectedState,

        city:
          String(
            data.get(
              'city',
            ) || '',
          ).trim(),
      };

      /*
       * Temporary client-side booking state.
       *
       * This is only used to move the entered
       * attendee details to the next step.
       *
       * Slot availability must still be
       * re-validated by the server before
       * creating the final booking.
       */
      sessionStorage.setItem(
        `ssi-booking-details:${eventId}`,
        JSON.stringify(
          bookingDetails,
        ),
      );

      void trackActivity(
        'form_submitted',
        {
          eventId,
          metadata: bookingDetails,
        },
      );

      router.push(
        `/events/${encodeURIComponent(
          eventId,
        )}/book/slots`,
      );
    } catch (
      error: unknown
    ) {
      console.error(
        'Booking form error:',
        error,
      );

      setFormError(
        error instanceof Error
          ? error.message
          : 'Unable to continue to time slots.',
      );

      setSubmitting(false);
    }
  }

  return (
    <main
      className="
        min-h-dvh
        w-full
        overflow-x-hidden
        bg-[#F7F9FB]
      "
    >
      <div
        className="
          mx-auto
          w-full
          max-w-[1500px]

          px-3
          pb-5
          pt-4

          min-[390px]:px-4

          sm:px-5
          sm:pb-6
          sm:pt-5

          md:px-6
          md:pb-8

          lg:px-8
          lg:py-7

          xl:px-10
          xl:py-8
        "
      >
        <form
          ref={formRef}
          data-booking-form={eventId}
          onSubmit={
            handleSubmit
          }
          className="
            max-md:pb-24 w-full
            min-w-0
          "
        >
          {/* BRAND */}

          <div
            className="
              max-md:hidden flex
              justify-center
            "
          >
            <div
              className="
                inline-flex
                h-10
                max-w-full
                items-center
                gap-2

                rounded-full

                border
                border-primary/25

                bg-white

                px-4

                shadow-[0_6px_20px_rgba(27,75,107,0.08)]
              "
            >
              <Image
                src="/logos/ssilogo.png"
                alt="SSI"
                width={19}
                height={19}
                priority
                className="
                  h-[19px]
                  w-[19px]
                  shrink-0
                  object-contain
                "
              />

              <span
                className="
                  truncate
                  whitespace-nowrap
                  text-[12px]
                  font-semibold
                  text-secondary
                "
              >
                SSI Maya Connect
              </span>
            </div>
          </div>

          {/* HEADER */}

          <header
            className="
              mt-0 max-md:mb-1 md:mt-6
              max-w-2xl

              sm:mt-7

              lg:mt-8
            "
          >
            <h1
              className="
                font-heading

                text-[19px]
                font-bold

                leading-[1.16]

                tracking-[-0.025em]

                text-secondary

                sm:text-[28px]

                lg:text-[30px]
              "
            >
              Practitioner Details
            </h1>
          </header>

          {/* ERROR */}

          {formError && (
            <div
              role="alert"
              className="
                mt-5

                rounded-xl

                border
                border-red-200

                bg-red-50

                px-4
                py-3

                text-xs
                font-medium
                leading-5

                text-red-700
              "
            >
              {formError}
            </div>
          )}

          {/* HIDDEN */}

          <input
            type="hidden"
            name="eventId"
            value={eventId}
          />

          <input
            type="hidden"
            name="eventName"
            value={eventName}
          />

          <input
            type="hidden"
            name="countryCode"
            value={
              selectedPhoneCountry.callingCode
            }
          />

          <input
            type="hidden"
            name="phoneCountry"
            value={
              selectedPhoneCountry.iso2
            }
          />

          {/* FORM */}

          <div
            className="
              mt-6

              grid
              grid-cols-1

              gap-x-5
              gap-y-4

              md:grid-cols-2

              lg:mt-7
              lg:gap-x-6
              lg:gap-y-5
            "
          >
            {/* DESIGNATION */}

            <Field label="Designation">
              <select
                name="designation"
                required
                defaultValue={
                  removeDesignationPlaceholder
                    ? 'Delegate'
                    : ''
                }
                aria-label="Faculty or Delegate"
                className={`${inputClass} cursor-pointer`}
              >
                {!removeDesignationPlaceholder && (
                  <option
                    value=""
                    disabled
                  >
                    Select Faculty / Delegate
                  </option>
                )}

                <option value="Delegate">
                  Delegate
                </option>

                <option value="Faculty">
                  Faculty
                </option>
              </select>
            </Field>

            {/* FULL NAME */}

            <Field label="Full Name & Title">
              <div
                className="
                  grid
                  min-w-0
                  grid-cols-[76px_minmax(0,1fr)]
                  gap-2

                  sm:grid-cols-[84px_minmax(0,1fr)]
                "
              >
                <select
                  name="title"
                  required
                  defaultValue="Dr."
                  aria-label="Title"
                  className={`${inputClass} cursor-pointer px-3`}
                >
                  <option value="Dr.">
                    Dr.
                  </option>

                  <option value="Prof.">
                    Prof.
                  </option>

                  <option value="Mr.">
                    Mr.
                  </option>

                  <option value="Ms.">
                    Ms.
                  </option>

                  <option value="Mrs.">
                    Mrs.
                  </option>
                </select>

                <input
                  name="fullName"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="e.g. Ramesh Kumar"
                  className={
                    inputClass
                  }
                />
              </div>
            </Field>

            {/* SPECIALTY */}

            <Field label="Specialty / Department">
              <input
                name="specialty"
                type="text"
                required
                placeholder="e.g. Cardiology"
                className={
                  inputClass
                }
              />
            </Field>

            {/* PHONE */}

            <Field label="Mobile Number">
              <div
                className="
                  grid
                  min-w-0
                  grid-cols-[100px_minmax(0,1fr)]
                  gap-2

                  sm:grid-cols-[118px_minmax(0,1fr)]
                "
              >
                <PhoneCountrySelector
                  countries={
                    filteredPhoneCountries
                  }
                  selected={
                    selectedPhoneCountry
                  }
                  loading={
                    countriesLoading
                  }
                  open={
                    phoneMenuOpen
                  }
                  search={
                    phoneSearch
                  }
                  dropdownRef={
                    phoneMenuRef
                  }
                  onToggle={() =>
                    setPhoneMenuOpen(
                      (current) =>
                        !current,
                    )
                  }
                  onSearch={
                    setPhoneSearch
                  }
                  onSelect={(
                    country,
                  ) => {
                    setSelectedPhoneCountry(
                      country,
                    );

                    setPhoneMenuOpen(
                      false,
                    );

                    setPhoneSearch('');
                  }}
                />

                <input
                  name="mobile"
                  type="tel"
                  required
                  inputMode="tel"
                  autoComplete="tel-national"
                  maxLength={14}
                  placeholder="10-digit mobile number"
                  className={
                    inputClass
                  }
                  onInput={(
                    event,
                  ) => {
                    event.currentTarget.value =
                      event.currentTarget.value.replace(
                        /[^\d\s-]/g,
                        '',
                      );
                  }}
                />
              </div>
            </Field>

            {/* EMAIL */}

            <div className="md:col-span-2">
              <Field label="Email Address">
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="doctor@hospital.com"
                  className={
                    inputClass
                  }
                />
              </Field>
            </div>

            {/* HOSPITAL */}

            <div className="md:col-span-2">
              <Field label="Hospital Name">
                <input
                  name="hospitalName"
                  type="text"
                  required
                  autoComplete="organization"
                  placeholder="e.g. All India Institute of Medical Sciences"
                  className={
                    inputClass
                  }
                />
              </Field>
            </div>

            {/* COUNTRY */}

            <Field label="Country">
              <CountrySelector
                countries={
                  filteredCountries
                }
                selected={
                  selectedCountry
                }
                loading={
                  countriesLoading
                }
                open={
                  countryMenuOpen
                }
                search={
                  countrySearch
                }
                dropdownRef={
                  countryMenuRef
                }
                onToggle={() =>
                  setCountryMenuOpen(
                    (current) =>
                      !current,
                  )
                }
                onSearch={
                  setCountrySearch
                }
                onSelect={(
                  country,
                ) => {
                  setSelectedCountry(
                    country,
                  );

                  setCountryMenuOpen(
                    false,
                  );

                  setCountrySearch('');
                }}
              />
            </Field>

            {/* STATE */}

            <Field label="State / Province">
              {states.length > 0 ? (
                <select
                  name="state"
                  required
                  disabled={
                    statesLoading
                  }
                  value={
                    selectedState
                  }
                  onChange={(
                    event,
                  ) =>
                    setSelectedState(
                      event.target.value,
                    )
                  }
                  className={`${inputClass} cursor-pointer`}
                >
                  <option value="">
                    {statesLoading
                      ? 'Loading...'
                      : 'Select state'}
                  </option>

                  {states.map(
                    (state) => (
                      <option
                        key={`${state.code}-${state.name}`}
                        value={
                          state.name
                        }
                      >
                        {state.name}
                      </option>
                    ),
                  )}
                </select>
              ) : (
                <input
                  name="state"
                  type="text"
                  required
                  disabled={
                    statesLoading
                  }
                  value={
                    selectedState
                  }
                  onChange={(
                    event,
                  ) =>
                    setSelectedState(
                      event.target.value,
                    )
                  }
                  placeholder={
                    statesLoading
                      ? 'Loading...'
                      : 'e.g. Delhi'
                  }
                  className={
                    inputClass
                  }
                />
              )}
            </Field>

            {/* CITY */}

            <div className="md:col-span-2">
              <Field label="City / Town">
                <input
                  name="city"
                  type="text"
                  required
                  autoComplete="address-level2"
                  placeholder="e.g. New Delhi"
                  className={
                    inputClass
                  }
                />
              </Field>
            </div>
          </div>

          {/* ACTIONS */}

          <div
            className="
              mt-7

              flex
              flex-col
              gap-2.5

              sm:grid
              sm:grid-cols-2
              sm:gap-3

              lg:mt-8
              max-md:fixed max-md:inset-x-0 max-md:bottom-[var(--user-nav-h,0px)] max-md:z-30 max-md:mt-0 max-md:flex-row max-md:border-t max-md:border-gray-200/80 max-md:bg-white/95 max-md:px-4 max-md:py-2.5 max-md:backdrop-blur-xl
            "
          >
            <button
              type="button"
              onClick={() =>
                router.back()
              }
              className="
                max-md:order-1 max-md:h-11 max-md:w-auto max-md:shrink-0 max-md:px-5 order-2

                flex
                h-12
                w-full

                cursor-pointer

                items-center
                justify-center

                rounded-xl

                border
                border-primary

                bg-white

                px-4

                text-sm
                font-semibold
                text-primary

                transition-all
                duration-200

                hover:bg-primary/[0.04]

                active:scale-[0.995]

                sm:order-1
              "
            >
              Go Back
            </button>

            <button
              type="submit"
              disabled={
                submitting
              }
              className="
                max-md:order-2 max-md:h-11 max-md:flex-1 order-1

                flex
                h-12
                w-full

                cursor-pointer

                items-center
                justify-center

                rounded-xl

                bg-primary

                px-4

                text-sm
                font-semibold
                text-white

                shadow-[0_8px_20px_rgba(26,158,143,0.18)]

                transition-all
                duration-200

                hover:-translate-y-0.5
                hover:brightness-95

                active:translate-y-0
                active:scale-[0.995]

                disabled:cursor-not-allowed
                disabled:opacity-60

                sm:order-2
              "
            >
              {submitting ? (
                <span
                  className="
                    flex
                    items-center
                    gap-2
                  "
                >
                  <span
                    className="
                      h-4
                      w-4

                      animate-spin

                      rounded-full

                      border-2
                      border-white/35
                      border-t-white
                    "
                  />

                  Loading Time Slots...
                </span>
              ) : (
                'Continue to Time Slots'
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

/* ============================================================
   PHONE COUNTRY SELECTOR
============================================================ */

function PhoneCountrySelector({
  countries,
  selected,
  loading,
  open,
  search,
  dropdownRef,
  onToggle,
  onSearch,
  onSelect,
}: {
  countries: CountryOption[];
  selected: CountryOption;
  loading: boolean;
  open: boolean;
  search: string;

  dropdownRef:
    RefObject<HTMLDivElement | null>;

  onToggle: () => void;

  onSearch: (
    value: string,
  ) => void;

  onSelect: (
    country: CountryOption,
  ) => void;
}) {
  return (
    <div
      ref={dropdownRef}
      className="relative min-w-0"
    >
      <button
        type="button"
        aria-label="Select phone country code"
        onClick={onToggle}
        className="
          flex
          h-12
          w-full
          min-w-0
          cursor-pointer
          items-center
          justify-between
          gap-1.5
          rounded-xl
          border
          border-gray-200
          bg-white
          px-3
          text-sm
          font-semibold
          text-secondary
          outline-none
          transition-all
          duration-200
          hover:border-primary/35
          focus:border-primary
          focus:ring-4
          focus:ring-primary/[0.08]
        "
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-base">
            {selected.flag}
          </span>

          <span className="truncate">
            {selected.callingCode}
          </span>
        </span>

        <Chevron open={open} />
      </button>

      {open && (
        <DropdownShell>
          <SearchBox
            value={search}
            onChange={onSearch}
            placeholder="Search country or code"
          />

          <div
            className="
              max-h-[280px]
              overflow-y-auto
              overscroll-contain
              p-1.5
            "
          >
            {loading ? (
              <LoadingText text="Loading country codes..." />
            ) : countries.length ===
              0 ? (
              <LoadingText text="No country found." />
            ) : (
              countries.map(
                (country) => (
                  <button
                    key={`${country.iso2}-${country.callingCode}`}
                    type="button"
                    onClick={() =>
                      onSelect(
                        country,
                      )
                    }
                    className="
                      flex
                      w-full
                      cursor-pointer
                      items-center
                      gap-3
                      rounded-lg
                      px-3
                      py-2.5
                      text-left
                      transition-colors
                      duration-150
                      hover:bg-gray-50
                    "
                  >
                    <span className="shrink-0 text-lg">
                      {country.flag}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-secondary">
                        {
                          country.name
                        }
                      </span>

                      <span className="text-[10px] text-gray-400">
                        {
                          country.iso2
                        }
                      </span>
                    </span>

                    <span className="shrink-0 text-xs font-semibold text-primary">
                      {
                        country.callingCode
                      }
                    </span>
                  </button>
                ),
              )
            )}
          </div>
        </DropdownShell>
      )}
    </div>
  );
}

/* ============================================================
   COUNTRY SELECTOR
============================================================ */

function CountrySelector({
  countries,
  selected,
  loading,
  open,
  search,
  dropdownRef,
  onToggle,
  onSearch,
  onSelect,
}: {
  countries: CountryOption[];
  selected: CountryOption;
  loading: boolean;
  open: boolean;
  search: string;

  dropdownRef:
    RefObject<HTMLDivElement | null>;

  onToggle: () => void;

  onSearch: (
    value: string,
  ) => void;

  onSelect: (
    country: CountryOption,
  ) => void;
}) {
  return (
    <div
      ref={dropdownRef}
      className="relative min-w-0"
    >
      <button
        type="button"
        onClick={onToggle}
        className="
          flex
          h-12
          w-full
          min-w-0
          cursor-pointer
          items-center
          justify-between
          rounded-xl
          border
          border-gray-200
          bg-white
          px-3.5
          text-sm
          font-medium
          text-secondary
          outline-none
          transition-all
          duration-200
          hover:border-primary/35
          focus:border-primary
          focus:ring-4
          focus:ring-primary/[0.08]
        "
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="shrink-0 text-lg">
            {selected.flag}
          </span>

          <span className="truncate">
            {selected.name}
          </span>
        </span>

        <Chevron open={open} />
      </button>

      {open && (
        <DropdownShell fullWidth>
          <SearchBox
            value={search}
            onChange={onSearch}
            placeholder="Search country"
          />

          <div
            className="
              max-h-[280px]
              overflow-y-auto
              overscroll-contain
              p-1.5
            "
          >
            {loading ? (
              <LoadingText text="Loading countries..." />
            ) : countries.length ===
              0 ? (
              <LoadingText text="No country found." />
            ) : (
              countries.map(
                (country) => (
                  <button
                    key={
                      country.iso2
                    }
                    type="button"
                    onClick={() =>
                      onSelect(
                        country,
                      )
                    }
                    className="
                      flex
                      w-full
                      cursor-pointer
                      items-center
                      gap-3
                      rounded-lg
                      px-3
                      py-2.5
                      text-left
                      transition-colors
                      duration-150
                      hover:bg-gray-50
                    "
                  >
                    <span className="shrink-0 text-lg">
                      {
                        country.flag
                      }
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-secondary">
                        {
                          country.name
                        }
                      </span>

                      <span className="text-[10px] text-gray-400">
                        {
                          country.iso2
                        }
                      </span>
                    </span>
                  </button>
                ),
              )
            )}
          </div>
        </DropdownShell>
      )}

      <input
        type="hidden"
        name="country"
        value={
          selected.name
        }
      />
    </div>
  );
}

/* ============================================================
   DROPDOWN
============================================================ */

function DropdownShell({
  children,
  fullWidth = false,
}: {
  children: ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={`
        absolute
        left-0
        top-[52px]
        z-[100]

        overflow-hidden

        rounded-xl

        border
        border-gray-200

        bg-white

        shadow-[0_20px_55px_rgba(27,75,107,0.16)]

        ${
          fullWidth
            ? `
              w-full
              min-w-0
              max-w-[calc(100vw-24px)]
            `
            : `
              w-[min(320px,calc(100vw-24px))]
              max-w-[calc(100vw-24px)]
              sm:w-[340px]
            `
        }
      `}
    >
      {children}
    </div>
  );
}

/* ============================================================
   SEARCH
============================================================ */

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;

  onChange: (
    value: string,
  ) => void;

  placeholder: string;
}) {
  return (
    <div
      className="
        border-b
        border-gray-100
        p-2.5
      "
    >
      <div className="relative">
        <svg
          className="
            pointer-events-none
            absolute
            left-3
            top-1/2
            h-4
            w-4
            -translate-y-1/2
            text-gray-400
          "
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle
            cx="11"
            cy="11"
            r="7"
          />

          <path
            strokeLinecap="round"
            d="m20 20-3.5-3.5"
          />
        </svg>

        <input
          type="search"
          autoFocus
          value={value}
          onChange={(
            event,
          ) =>
            onChange(
              event.target.value,
            )
          }
          placeholder={placeholder}
          className="
            h-10
            w-full
            rounded-lg
            border
            border-gray-200
            bg-gray-50
            pl-9
            pr-3
            text-xs
            text-secondary
            outline-none
            transition-all
            duration-200
            placeholder:text-gray-400
            focus:border-primary
            focus:bg-white
            focus:ring-2
            focus:ring-primary/10
          "
        />
      </div>
    </div>
  );
}

/* ============================================================
   CHEVRON
============================================================ */

function Chevron({
  open,
}: {
  open: boolean;
}) {
  return (
    <svg
      className={`
        h-4
        w-4
        shrink-0
        text-gray-400
        transition-transform
        duration-200

        ${
          open
            ? 'rotate-180'
            : ''
        }
      `}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m6 9 6 6 6-6"
      />
    </svg>
  );
}

/* ============================================================
   LOADING
============================================================ */

function LoadingText({
  text,
}: {
  text: string;
}) {
  return (
    <div
      className="
        flex
        items-center
        justify-center
        gap-2
        px-3
        py-6
        text-xs
        text-gray-500
      "
    >
      <span
        className="
          h-3.5
          w-3.5
          animate-spin
          rounded-full
          border-2
          border-gray-200
          border-t-primary
        "
      />

      {text}
    </div>
  );
}

/* ============================================================
   FIELD
============================================================ */

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label
        className={
          labelClass
        }
      >
        {label}

        <span className="ml-1 text-red-500">
          *
        </span>
      </label>

      {children}
    </div>
  );
}