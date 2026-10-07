'use client';

import { useHydrated } from '@/lib/use-hydrated';
import { eventTimeZone } from '@/lib/events/dates';
import { hasSlotEnded } from '@/lib/events/status';
import { ticketStorage } from '@/lib/booking-contracts';

import { isValidPhone, normalizePhone } from '@/lib/phone';
import { chooseCountries, INDIA_FALLBACK, type CountryOption } from '@/lib/country-defaults';

import Image from 'next/image';
import Link from 'next/link';


import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  AnimatePresence,
  motion,
} from 'framer-motion';

import {
  QRCodeSVG,
} from 'qrcode.react';
import {
  useRealtimeRefresh,
} from '@/components/realtime/RealtimeProvider';


/* ============================================================
   TYPES
============================================================ */

type TicketStatus =
  | 'ACTIVE'
  | 'EXPIRED'
  | 'ATTENDED'
  | 'CANCELLED';


interface Ticket {
  timeZone?: string;

  bookingId:
    string;

  eventId:
    string;

  eventName:
    string;

  venue:
    string;

  imageUrl:
    string;

  date:
    string;

  startTime:
    string;

  endTime:
    string;


  status:
    TicketStatus;


  attendanceStatus:
    string;


  checkedInAt:
    string | null;


  checkedInBy:
    string;


  checkInMethod:
    string;


  qrData:
    string;
}



/* ============================================================
   CONSTANTS
============================================================ */

const CACHE_KEY =
  ticketStorage.mobile;






/* ============================================================
   PAGE
============================================================ */


export default function MyTicketsPage() {


  const hydrated = useHydrated();
  const [mobile, setMobile] = useState('');
  const [countries, setCountries] = useState<CountryOption[]>([INDIA_FALLBACK]);
  const [phoneCountry, setPhoneCountry] = useState(INDIA_FALLBACK);
  const [savedMobile, setSavedMobile] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loaded, setLoaded] = useState(false);
  const lookupRef = useRef<string | null>(null);
  const pendingRef = useRef<AbortController | null>(null);
  const requestVersion = useRef(0);

  const loadTickets = useCallback(async (value: string) => {
    const clean = normalizePhone(value);
    if (!isValidPhone(value)) {
      setError('Enter the mobile number you registered with.');
      return;
    }
    pendingRef.current?.abort();
    const controller = new AbortController();
    pendingRef.current = controller;
    const version = ++requestVersion.current;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/events/mytickets', {
        method: 'POST', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile: clean }),
      });
      const data = await response.json();
      if (version !== requestVersion.current || controller.signal.aborted) return;
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load your ticket. Please retry.');
      setTickets(data.tickets);
      setSelectedTicket(current => current ? data.tickets.find((ticket: Ticket) => ticket.bookingId === current.bookingId) || null : null);
      setSavedMobile(clean);
      setMobile(clean);
      lookupRef.current = clean;
      setLoaded(true);
      // Remember this device's number until its last ticket's slot ends, so tickets show without retyping.
      const keep = (data.tickets as Ticket[]).some(ticket => ticket.status !== 'CANCELLED' && !!ticket.date
        && !hasSlotEnded(ticket.date, ticket.endTime, new Date(), ticket.timeZone));
      try { if (keep) localStorage.setItem(CACHE_KEY, clean); else localStorage.removeItem(CACHE_KEY); } catch { /* Storage is optional. */ }
    } catch (error) {
      if (version !== requestVersion.current || controller.signal.aborted) return;
      setError(error instanceof Error ? error.message : 'Unable to load your ticket. Please retry.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const cachedMobile = localStorage.getItem(CACHE_KEY);
        if (cachedMobile) void loadTickets(cachedMobile);
      } catch { /* Start with an empty lookup when browser storage is unavailable. */ }
    }, 0);
    return () => { window.clearTimeout(timer); pendingRef.current?.abort(); };
  }, [loadTickets]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/location/countries', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) })
      .then(response => response.json())
      .then(data => {
        if (!data?.success || !Array.isArray(data.countries)) return;
        const list = (data.countries as CountryOption[]).filter(country => country.callingCode);
        if (!list.length) return;
        setCountries(list);
        setPhoneCountry(chooseCountries(list).phone);
      })
      .catch(() => { /* Keep India as the only option. */ });
    return () => controller.abort();
  }, []);

  /** The number as typed, with the selected country code unless the visitor typed their own +code. */
  function fullNumber(value: string) {
    if (value.trim().startsWith('+')) return value;
    return phoneCountry.callingCode + normalizePhone(value).replace(/^0+/, '');
  }

  function refreshTickets() {
    if (lookupRef.current) void loadTickets(lookupRef.current);
  }
  useRealtimeRefresh('attendance', refreshTickets);
  useRealtimeRefresh('bookings', refreshTickets);

  function resetTickets() {
    requestVersion.current++;
    pendingRef.current?.abort();
    pendingRef.current = null;
    lookupRef.current = null;
    setMobile(''); setSavedMobile(''); setTickets([]);
    setSelectedTicket(null); setLoaded(false); setLoading(false); setError('');
    try { localStorage.removeItem(CACHE_KEY); } catch { /* Nothing to restore. */ }
  }

  function changeMobile(value: string) {
    requestVersion.current++;
    pendingRef.current?.abort();
    pendingRef.current = null;
    setLoading(false);
    setError('');
    setMobile(value);
  }

  /* ==========================================================
     UI
  ========================================================== */


  return (

    <main
      className="
        min-h-dvh

        bg-[#F7F9FA]

        pb-[76px]

        md:pb-0
      "
    >


      {/* HEADER */}


      <header
        className="
          sticky
          top-0
          z-50

          hidden

          border-b
          border-gray-200/80

          bg-white/95

          backdrop-blur-xl

          md:block
        "
      >

        <div
          className="
            mx-auto

            grid

            h-[66px]

            w-full
            max-w-[1500px]

            items-center
            gap-6

            grid-cols-[auto_1fr_auto]

            px-6

            lg:px-10
          "
        >

          <Link
            href="/"
            className="
              flex

              items-center

              gap-2
            "
          >

            <Image
              src="/logos/ssilogo.png"
              alt="SSI"
              width={26}
              height={26}
            />


            <span
              className="
                text-[13px]
                font-semibold

                text-secondary
              "
            >
              SSI Maya Connect
            </span>

          </Link>

          <Link
            href="/events"
            className="
              inline-flex
              shrink-0
              h-8
              w-fit
              justify-self-center

              items-center
              justify-center
              gap-1.5

              rounded-lg

              border
              border-primary/20

              bg-white

              px-2.5

              text-[10px]
              font-semibold

              text-secondary

              shadow-[0_2px_8px_rgba(27,75,107,0.04)]

              transition-all

              hover:border-primary/35
              hover:bg-primary/[0.04]
              hover:text-primary

              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-primary/15
            "
          >
            Browse Events

            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 12h14m-6-6 6 6-6 6"
              />
            </svg>
          </Link>

        </div>

      </header>

      <header
        className=" max-md:hidden
          sticky
          top-0
          z-50

          border-b
          border-gray-200/80

          bg-[#F7F9FA]/95

          px-4
          py-3

          backdrop-blur-xl

          md:hidden
        "
      >
        <div
          className="
            mx-auto
            flex
            max-w-[520px]
            items-center
            justify-between
            gap-3
          "
        >
          <Link
            href="/"
            className="
              flex
              min-w-0
              items-center
              gap-2
            "
          >
            <Image
              src="/logos/ssilogo.png"
              alt="SSI"
              width={24}
              height={24}
              priority
            />
            <span
              className="
                truncate
                text-[13px]
                font-semibold
                text-secondary
              "
            >
              SSI Maya Connect
            </span>
          </Link>

        </div>
      </header>


      <div
        className="
          mx-auto

          w-full
          max-w-[1500px]

          px-4

          py-5

          md:px-6
          md:py-8

          lg:px-10
        "
      >


        {/* TITLE */}


        <motion.div
          initial={{
            opacity:0,
            y:5,
          }}
          animate={{
            opacity:1,
            y:0,
          }}
        >

          <h1
            className="
              font-heading

              text-[26px]

              font-bold

              tracking-[-0.03em]

              text-secondary
            "
          >
            My Tickets
          </h1>


          <p
            className="
              mt-1

              text-[12px]

              text-gray-500
            "
          >
            Access your registered event tickets.
          </p>

          {(savedMobile || loading) && (
            <button
              type="button"
              onClick={resetTickets}
              className="
                mt-3
                text-[11px]
                font-semibold
                text-primary
                hover:text-primary-dark
              "
            >
              Look up another ticket
            </button>
          )}


        </motion.div>





        {/* MOBILE INPUT */}


        {!savedMobile && (

          <motion.section
            initial={{
              opacity:0,
              y:10,
            }}
            animate={{
              opacity:1,
              y:0,
            }}
            className="
              mt-6

              rounded-xl

              border
              border-gray-200

              bg-white

              p-5
            "
          >

            <label
              htmlFor="ticket-mobile"
              className="
                text-[11px]

                font-semibold

                text-secondary
              "
            >
              Registered mobile number
            </label>


            <div className="mt-2 flex gap-2">
              <select disabled={!hydrated}
                aria-label="Country code"
                value={phoneCountry.iso2}
                onChange={e => {
                  const next = countries.find(country => country.iso2 === e.target.value);
                  if (next) { setPhoneCountry(next); changeMobile(mobile); }
                }}
                className="h-11 w-28 shrink-0 rounded-lg border border-gray-200 bg-white px-2 text-[13px] outline-none focus:border-primary/40"
              >
                {countries.map(country => (
                  <option key={country.iso2} value={country.iso2}>{country.flag} {country.callingCode} {country.name}</option>
                ))}
              </select>

            <input disabled={!hydrated}
              id="ticket-mobile"
              value={
                mobile
              }

              onChange={
                e =>
                  changeMobile(e.target.value)
              }

              onKeyDown={(e) => {
                if (e.key === 'Enter') void loadTickets(fullNumber(mobile));
              }}

              placeholder="Mobile number, e.g. 98765 43210"

              inputMode="tel"

              className="


                h-11

                min-w-0 flex-1

                rounded-lg

                border
                border-gray-200

                px-3

                text-[13px]

                outline-none

                focus:border-primary/40
              "
            />
            </div>



            <p className="mt-3 text-xs text-gray-500">Enter the mobile number you registered with. No email or OTP is needed.</p>

            <button
              disabled={!hydrated || loading}
              onClick={() =>
                void loadTickets(fullNumber(mobile))
              }

              className="
                mt-3

                h-11

                w-full

                rounded-lg

                bg-primary

                text-[12px]

                font-semibold

                text-white
              "
            >

              {loading
                ? 'Checking...'
                : 'View Tickets'}

            </button>


          </motion.section>

        )}






        {/* ERROR */}


        {
          error && (

            <div
              className="
                mt-5

                rounded-lg

                border
                border-red-200

                bg-red-50

                px-4
                py-3

                text-[12px]

                text-red-700
              "
            >

              {error}

            </div>

          )
        }






        {/* EMPTY */}


        {
          loaded &&
          tickets.length===0 && (

            <div
              className="
                mt-6

                rounded-xl

                border
                border-gray-200

                bg-white

                p-8

                text-center
              "
            >

              <h2
                className="
                  text-[16px]

                  font-semibold

                  text-secondary
                "
              >
                No tickets found
              </h2>


              <p
                className="
                  mt-2

                  text-[12px]

                  text-gray-500
                "
              >
                No ticket matches this mobile number.
              </p>


            </div>

          )
        }






        {/* TICKETS */}


        <div
          className="
            mt-6

            grid
            grid-cols-1
            gap-4

            md:grid-cols-2

            xl:grid-cols-3
          "
        >

          {
            tickets.map(
              ticket => (

                <TicketCard

                  key={
                    ticket.bookingId
                  }

                  ticket={
                    ticket
                  }

                  onClick={() =>
                    setSelectedTicket(
                      ticket,
                    )
                  }

                />

              ),
            )
          }


        </div>


      </div>





      {/* QR MODAL */}


      <AnimatePresence>

        {
          selectedTicket && (

            <motion.div

              initial={{
                opacity:0,
              }}

              animate={{
                opacity:1,
              }}

              exit={{
                opacity:0,
              }}

              className="
                fixed

                inset-0

                z-50

                flex

                items-center

                justify-center

                bg-black/40

                px-4
              "

              onClick={() =>
                setSelectedTicket(
                  null,
                )
              }

            >


              <motion.div

                initial={{
                  scale:.95,
                  opacity:0,
                }}

                animate={{
                  scale:1,
                  opacity:1,
                }}

                className="
                  rounded-2xl

                  bg-white

                  p-6

                  text-center
                "

                onClick={
                  e =>
                    e.stopPropagation()
                }

              >

                {selectedTicket.status === 'CANCELLED' ? <p className="max-w-xs font-semibold text-red-700">Event cancelled. This ticket is not valid for admission.</p> : (<QRCodeSVG

                  value={
                    selectedTicket.qrData
                  }

                  size={
                    220
                  }

                />)}


                <p
                  className="
                    mt-4

                    text-[13px]

                    font-semibold

                    text-secondary
                  "
                >
                  {
                    selectedTicket.bookingId
                  }
                </p>


                <button

                  onClick={() =>
                    setSelectedTicket(
                      null,
                    )
                  }

                  className="
                    mt-5

                    h-10

                    rounded-lg

                    bg-primary

                    px-6

                    text-[12px]

                    font-semibold

                    text-white
                  "
                >

                  Close

                </button>


              </motion.div>


            </motion.div>

          )
        }

      </AnimatePresence>



    </main>

  );
}






/* ============================================================
   CARD
============================================================ */


function TicketCard({
  ticket,
  onClick,
}:{
  ticket:
    Ticket;

  onClick:
    ()=>void;
}) {


  return (

    <motion.article

      initial={{
        opacity:0,
        y:8,
      }}

      animate={{
        opacity:1,
        y:0,
      }}

      className="
        overflow-hidden

        rounded-xl

        border
        border-gray-200

        bg-white

        shadow-sm
      "

    >


      <div
        className="
          relative

          h-[150px]

          bg-gray-100
        "
      >

        {
          ticket.imageUrl ? (

            <Image width={1200} height={600} unoptimized

              src={
                ticket.imageUrl
              }

              alt=""

              className="
                h-full

                w-full

                object-cover
              "

            />

          ):(

            <div
              className="
                flex

                h-full

                items-center

                justify-center

                text-gray-400
              "
            >
              SSI
            </div>

          )
        }



        <StatusBadge
          status={
            ticket.status
          }
        />


      </div>





      <div
        className="
          p-4
        "
      >


        <h2
          className="
            text-[17px]

            font-semibold

            text-secondary
          "
        >
          {
            ticket.eventName
          }
        </h2>



        <p
          className="
            mt-2

            text-[12px]

            text-gray-500
          "
        >
          {ticket.date
              ? new Date(ticket.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
              : ''}

          {' · '}

          {
            ticket.startTime
          }

          {' - '}

          {
            ticket.endTime
          } {eventTimeZone(ticket.timeZone)}

        </p>



        <p
          className="
            mt-1

            text-[12px]

            text-gray-500
          "
        >
          {
            ticket.venue
          }
        </p>





        <div
          className="
            mt-4

            flex

            items-center

            justify-between
          "
        >

          <span
            className="
              text-[11px]

              font-semibold

              text-gray-400
            "
          >
            {
              ticket.bookingId
            }
          </span>



          <button
            onClick={
              onClick
            }

            className="
              rounded-lg

              bg-primary

              px-4

              py-2

              text-[11px]

              font-semibold

              text-white
            "
          >
            {ticket.status === 'CANCELLED' ? 'View cancellation' : 'QR Ticket'}
          </button>


        </div>


      </div>


    </motion.article>

  );
}






function StatusBadge({
  status,
}:{
  status:
    TicketStatus;
}) {


  const style =
    status === 'ACTIVE'
      ? 'bg-emerald-50 text-emerald-700'
      :
      status === 'ATTENDED'
      ? 'bg-primary/10 text-primary'
      :
      'bg-gray-100 text-gray-600';



  return (

    <span
      className={`
        absolute

        right-3

        top-3

        rounded-full

        px-3

        py-1

        text-[10px]

        font-semibold

        ${style}
      `}
    >

      {status}

    </span>

  );

}
