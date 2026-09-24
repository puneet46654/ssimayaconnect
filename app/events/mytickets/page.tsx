'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import {
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
  | 'ATTENDED';


interface Ticket {

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
  'ssi-my-tickets-mobile';

const EMAIL_CACHE_KEY =
  'ssi-my-tickets-email';

const TICKET_CACHE =
  'ssi-my-tickets-data';


const EASE = [
  0.16,
  1,
  0.3,
  1,
] as const;


/* ============================================================
   PAGE
============================================================ */


export default function MyTicketsPage() {


  const [
    mobile,
    setMobile,
  ] =
    useState('');



  const [email, setEmail] = useState('');

  const [
    savedMobile,
    setSavedMobile,
  ] =
    useState('');



  const [
    tickets,
    setTickets,
  ] =
    useState<Ticket[]>(
      [],
    );



  const [
    loading,
    setLoading,
  ] =
    useState(false);



  const [
    error,
    setError,
  ] =
    useState('');



  const [
    selectedTicket,
    setSelectedTicket,
  ] =
    useState<Ticket | null>(
      null,
    );



  const [
    loaded,
    setLoaded,
  ] =
    useState(false);

  const loadedMobileRef =
    useRef('');




  /* ==========================================================
     LOAD CACHE
  ========================================================== */


  useEffect(() => {


    const cachedMobile =
      sessionStorage.getItem(
        CACHE_KEY,
      );


    const cachedTickets =
      sessionStorage.getItem(
        TICKET_CACHE,
      );



    const cachedEmail =
      sessionStorage.getItem(
        EMAIL_CACHE_KEY,
      );

    if (
      cachedMobile &&
      cachedEmail
    ) {

      window.setTimeout(() => {
        setMobile(
          cachedMobile,
        );

        setEmail(
          cachedEmail,
        );

        setSavedMobile(
          cachedMobile,
        );
      }, 0);

    }



    if (
      cachedTickets
    ) {

      try {

        const parsed =
          JSON.parse(
            cachedTickets,
          );

        window.setTimeout(() => {
          setTickets(parsed);

          setLoaded(
            true,
          );
        }, 0);

      } catch {}

    }


  }, []);




  /* ==========================================================
     FETCH
  ========================================================== */


  async function loadTickets(
    value =
      mobile,
    mail =
      email,
  ) {
    const cleanEmail = mail.trim().toLowerCase();



    const clean =
      value.replace(
        /\D/g,
        '',
      )
      .slice(
        -10,
      );



    if (
      clean.length !==
      10
    ) {

      setError(
        'Enter a valid mobile number.',
      );

      return;

    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      setError('Enter the email address used for booking.');
      return;
    }



    setLoading(
      true,
    );

    setError('');



    try {


      const response =
        await fetch(
          `/api/events/mytickets?mobile=${clean}&email=${encodeURIComponent(cleanEmail)}`,
          {
            cache:
              'no-store',
          },
        );



      const data =
        await response.json();



      if (
        !response.ok ||
        !data.success
      ) {

        throw new Error(
          data.message ||
          'Unable to load tickets.',
        );

      }

      setTickets(
        data.tickets,
      );



      sessionStorage.setItem(
        CACHE_KEY,
        clean,
      );

      sessionStorage.setItem(
        EMAIL_CACHE_KEY,
        cleanEmail,
      );


      sessionStorage.setItem(
        TICKET_CACHE,
        JSON.stringify(
          data.tickets,
        ),
      );



      setSavedMobile(
        clean,
      );

      loadedMobileRef.current =
        clean;


      setLoaded(
        true,
      );


    } catch (
      err
    ) {


      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load tickets.',
      );


    } finally {


      setLoading(
        false,
      );

    }

  }

  useRealtimeRefresh(
    'attendance',
    () => {
      if (loadedMobileRef.current) {
        void loadTickets(
          loadedMobileRef.current,
          sessionStorage.getItem(EMAIL_CACHE_KEY) || '',
        );
      }
    },
  );




  useEffect(() => {


    if (
      savedMobile &&
      loadedMobileRef.current !==
        savedMobile
    ) {

      void loadTickets(
        savedMobile,
        sessionStorage.getItem(EMAIL_CACHE_KEY) || '',
      );

    }


  }, [
    savedMobile,
  ]);




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

          {savedMobile && (
            <button
              type="button"
              onClick={() => {
                setSavedMobile('');
                setMobile('');
                setTickets([]);
                setLoaded(false);
                setError('');
                sessionStorage.removeItem(
                  CACHE_KEY,
                );
                sessionStorage.removeItem(
                  TICKET_CACHE,
                );
              }}
              className="
                mt-3
                text-[11px]
                font-semibold
                text-primary
                hover:text-primary-dark
              "
            >
              Use a different mobile number
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
              className="
                text-[11px]

                font-semibold

                text-secondary
              "
            >
              Registered mobile number
            </label>


            <input
              value={
                mobile
              }

              onChange={
                e =>
                  setMobile(
                    e.target.value,
                  )
              }

              placeholder="Enter mobile number"

              inputMode="tel"

              className="
                mt-2

                h-11

                w-full

                rounded-lg

                border
                border-gray-200

                px-3

                text-[13px]

                outline-none

                focus:border-primary/40
              "
            />



            <label className="mt-3 block text-[11px] font-semibold text-secondary">
              Registered email address
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void loadTickets();
              }}
              placeholder="Enter email used for booking"
              autoComplete="email"
              className="mt-2 h-11 w-full rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-primary/40"
            />

            <button
              onClick={() =>
                void loadTickets()
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
                No booking exists for this mobile number.
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

                <QRCodeSVG

                  value={
                    selectedTicket.qrData
                  }

                  size={
                    220
                  }

                />


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

            <img

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
          {
            ticket.date
          }

          {' · '}

          {
            ticket.startTime
          }

          {' - '}

          {
            ticket.endTime
          }

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
            QR Ticket
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

function MobileNavItem({
  href,
  label,
  icon,
  active = false,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`
        flex
        min-h-[54px]
        flex-col
        items-center
        justify-center
        gap-1
        text-[9px]
        font-medium
        transition-colors
        ${active ? 'text-primary' : 'text-gray-400'}
      `}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function HomeIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z"
      />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 5h14v4a3 3 0 0 0 0 6v4H5v-4a3 3 0 0 0 0-6V5Z"
      />
      <path
        strokeLinecap="round"
        d="M12 7v10"
      />
    </svg>
  );
}