'use client';

import Image from 'next/image';

import {
  useEffect,
  useState,
} from 'react';

import {
  AnimatePresence,
  motion,
} from 'framer-motion';

import {
  QRCodeSVG,
} from 'qrcode.react';


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




  /* ==========================================================
     LOAD CACHE
  ========================================================== */


  useEffect(() => {


    const cachedMobile =
      localStorage.getItem(
        CACHE_KEY,
      );


    const cachedTickets =
      localStorage.getItem(
        TICKET_CACHE,
      );



    if (
      cachedMobile
    ) {

      setMobile(
        cachedMobile,
      );


      setSavedMobile(
        cachedMobile,
      );

    }



    if (
      cachedTickets
    ) {

      try {

        setTickets(
          JSON.parse(
            cachedTickets,
          ),
        );

      } catch {}

    }


  }, []);




  /* ==========================================================
     FETCH
  ========================================================== */


  async function loadTickets(
    value =
      mobile,
  ) {


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



    setLoading(
      true,
    );

    setError('');



    try {


      const response =
        await fetch(
          `/api/events/mytickets?mobile=${clean}`,
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



      localStorage.setItem(
        CACHE_KEY,
        clean,
      );


      localStorage.setItem(
        TICKET_CACHE,
        JSON.stringify(
          data.tickets,
        ),
      );



      setSavedMobile(
        clean,
      );


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





  useEffect(() => {


    if (
      savedMobile
    ) {

      void loadTickets(
        savedMobile,
      );

    }


  }, []);




  /* ==========================================================
     UI
  ========================================================== */


  return (

    <main
      className="
        min-h-dvh

        bg-[#F7F9FA]

        pb-8
      "
    >


      {/* HEADER */}


      <header
        className="
          sticky
          top-0
          z-40

          border-b
          border-gray-200

          bg-white/95

          backdrop-blur-xl
        "
      >

        <div
          className="
            mx-auto

            flex

            h-[62px]

            max-w-[900px]

            items-center

            justify-between

            px-4
          "
        >

          <div
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

          </div>


          <span
            className="
              text-[12px]

              text-gray-500
            "
          >
            My Tickets
          </span>


        </div>

      </header>




      <div
        className="
          mx-auto

          max-w-[900px]

          px-4

          pt-6
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

            space-y-4
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