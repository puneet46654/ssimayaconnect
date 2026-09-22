'use client';

import {
  useParams,
  useRouter,
  useSearchParams,
} from 'next/navigation';

import {
  useEffect,
  useState,
} from 'react';

import {
  AnimatePresence,
  motion,
} from 'framer-motion';

import { trackActivity } from '@/lib/activity-client';

/* ============================================================
   TYPES
============================================================ */

type FeedbackData = {
  eventId: string;
  rating: number;
  message: string;
  suggestedFeature: string;
  submittedAt: string;
};

/* ============================================================
   ANIMATION
============================================================ */

const EASE = [
  0.22,
  1,
  0.36,
  1,
] as const;

const pageVariants = {
  hidden: {
    opacity: 0,
  },

  visible: {
    opacity: 1,

    transition: {
      duration: 0.45,
      ease: EASE,

      staggerChildren: 0.07,
      delayChildren: 0.04,
    },
  },
};

const itemVariants = {
  hidden: {
    opacity: 0,
    y: 14,
  },

  visible: {
    opacity: 1,
    y: 0,

    transition: {
      duration: 0.55,
      ease: EASE,
    },
  },
};

/* ============================================================
   PAGE
============================================================ */

export default function FeedbackPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const eventId =
    params.id;
  const router =
    useRouter();
  const searchParams =
    useSearchParams();
  const feedbackScope =
    searchParams.get('scope') ===
    'application'
      ? 'application'
      : 'event';
  const feedbackStorageKey =
    `ssi-feedback:${feedbackScope}:${eventId}`;
  const feedbackStateKey =
    `ssi-feedback-state:${feedbackScope}:${eventId}`;

  const [
    rating,
    setRating,
  ] =
    useState(0);

  const [
    hoveredRating,
    setHoveredRating,
  ] =
    useState(0);

  const [
    message,
    setMessage,
  ] =
    useState('');

  const [
    suggestedFeature,
    setSuggestedFeature,
  ] =
    useState('');

  const [
    submitted,
    setSubmitted,
  ] =
    useState(false);

  const [
    draftLoaded,
    setDraftLoaded,
  ] =
    useState(false);
  const [
    submitError,
    setSubmitError,
  ] = useState('');

  useEffect(() => {
    if (!eventId) {
      return;
    }

    try {
      const raw =
        sessionStorage.getItem(
          feedbackStorageKey,
        );

      if (!raw) {
        return;
      }

      const cached =
        JSON.parse(raw) as Partial<FeedbackData>;

      window.setTimeout(() => {
        setRating(
          typeof cached.rating === 'number'
            ? cached.rating
            : 0,
        );
        setMessage(
          cached.message || '',
        );
        setSuggestedFeature(
          cached.suggestedFeature || '',
        );
        setDraftLoaded(true);
      }, 0);
    } catch (error) {
      console.error(
        'Unable to restore feedback draft:',
        error,
      );
      window.setTimeout(() => {
        setDraftLoaded(true);
      }, 0);
    }
  }, [
    eventId,
    feedbackStorageKey,
  ]);

  useEffect(() => {
    if (
      !eventId ||
      submitted ||
      !draftLoaded
    ) {
      return;
    }

    try {
      sessionStorage.setItem(
        feedbackStorageKey,
        JSON.stringify({
          eventId,
          rating,
          message,
          suggestedFeature,
        }),
      );
    } catch (error) {
      console.error(
        'Unable to save feedback draft:',
        error,
      );
    }
  }, [
    eventId,
    draftLoaded,
    feedbackStorageKey,
    message,
    rating,
    submitted,
    suggestedFeature,
  ]);

  /* ============================================================
     NAVIGATION
  ============================================================ */

  function goToEvents() {
    router.push('/events');
  }

  function goToEvent() {
    router.push(
      `/events/${eventId}`,
    );
  }

  function goToTickets() {
    router.push(
      '/events/mytickets',
    );
  }

  function goBack() {
    if (feedbackScope === 'application') {
      router.push(
        `/events/${eventId}/book/confirm?feedback=skipped`,
      );
      return;
    }

    router.push('/events');
  }

  /* ============================================================
     SUBMIT
  ============================================================ */

  async function handleSubmit() {
    if (!eventId) {
      return;
    }

    setSubmitError('');

    const bookingId =
      sessionStorage.getItem(
        `ssi-feedback-booking-id:${eventId}`,
      ) ||
      sessionStorage.getItem(
        `ssi-server-booking-id:${eventId}`,
      ) || '';
    const bookingMongoId =
      sessionStorage.getItem(
        `ssi-feedback-booking-mongo-id:${eventId}`,
      ) ||
      sessionStorage.getItem(
        `ssi-server-booking-mongo-id:${eventId}`,
      ) || '';

    const feedback:
      FeedbackData = {
        eventId,

        rating,

        message:
          message.trim(),

        suggestedFeature:
          suggestedFeature.trim(),

        submittedAt:
          new Date().toISOString(),
      };

    try {
      sessionStorage.setItem(
        feedbackStorageKey,
        JSON.stringify(
          feedback,
        ),
      );

      sessionStorage.setItem(
        feedbackStateKey,
        'submitted',
      );

      const recorded =
        await trackActivity(
        'feedback_submitted',
        {
          eventId,
          metadata: {
            feedbackScope,
            bookingId,
            bookingMongoId,
            rating,
            message: message.trim(),
            suggestedFeature:
              suggestedFeature.trim(),
          },
        },
      );

      if (!recorded) {
        sessionStorage.removeItem(
          feedbackStateKey,
        );
        setSubmitError(
          'Feedback was already submitted for this experience, or could not be saved.',
        );
        return;
      }
    } catch (error) {
      console.error(
        'Unable to save feedback:',
        error,
      );
    }

    setSubmitted(
      true,
    );
  }

  /* ============================================================
     MAYBE LATER
  ============================================================ */

  async function handleMaybeLater() {
    if (!eventId) {
      return;
    }

    const bookingId =
      sessionStorage.getItem(
        `ssi-feedback-booking-id:${eventId}`,
      ) ||
      sessionStorage.getItem(
        `ssi-server-booking-id:${eventId}`,
      ) || '';
    const bookingMongoId =
      sessionStorage.getItem(
        `ssi-feedback-booking-mongo-id:${eventId}`,
      ) ||
      sessionStorage.getItem(
        `ssi-server-booking-mongo-id:${eventId}`,
      ) || '';

    try {
      sessionStorage.setItem(
        feedbackStateKey,
        'dismissed',
      );

      await trackActivity(
        'feedback_skipped',
        {
          eventId,
          metadata: {
            feedbackScope,
            bookingId,
            bookingMongoId,
          },
        },
      );
    } catch (error) {
      console.error(
        'Unable to update feedback state:',
        error,
      );
    }

    router.push(
      feedbackScope === 'application'
        ? `/events/${eventId}/book/confirm?feedback=skipped`
        : '/events',
    );
  }

  /* ============================================================
     SUCCESS VIEW
  ============================================================ */

  if (submitted) {
    return (
      <main
        className="
          relative
          grid
          min-h-dvh
          place-items-center
          overflow-hidden
          bg-[#F7F9FB]
          px-4
          py-10
        "
      >
        <motion.div
          initial={{
            opacity: 0,
            scale: 0.8,
          }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
          transition={{
            duration: 1,
            ease: EASE,
          }}
          className="
            pointer-events-none
            absolute
            left-1/2
            top-1/2
            h-[420px]
            w-[420px]
            -translate-x-1/2
            -translate-y-1/2
            rounded-full
            bg-primary/[0.035]
            blur-3xl
          "
        />

        <motion.section
          initial={{
            opacity: 0,
            y: 22,
            scale: 0.97,
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
          }}
          transition={{
            duration: 0.65,
            ease: EASE,
          }}
          className="
            relative
            z-10
            w-full
            max-w-[360px]
            rounded-[20px]
            border
            border-gray-200
            bg-white
            px-5
            py-6
            text-center
            shadow-[0_18px_55px_rgba(27,75,107,0.12)]
          "
        >
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.4,
              rotate: -8,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              rotate: 0,
            }}
            transition={{
              delay: 0.12,
              duration: 0.6,
              ease: EASE,
            }}
            className="
              mx-auto
              grid
              h-12
              w-12
              place-items-center
              rounded-full
              bg-primary
              text-white
              shadow-[0_10px_28px_rgba(26,158,143,0.22)]
            "
          >
            <svg
              className="
                h-6
                w-6
              "
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.6}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m5 12 4 4L19 6"
              />
            </svg>
          </motion.div>

          <motion.h1
            initial={{
              opacity: 0,
              y: 10,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.22,
              duration: 0.55,
              ease: EASE,
            }}
            className="
              mt-4
              font-heading
              text-[22px]
              font-bold
              tracking-[-0.03em]
              text-secondary
            "
          >
            Thank You!
          </motion.h1>

          <motion.p
            initial={{
              opacity: 0,
              y: 8,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.28,
              duration: 0.5,
              ease: EASE,
            }}
            className="
              mx-auto
              mt-2
              max-w-[330px]
              text-[13px]
              leading-6
              text-gray-500
            "
          >
            Thank you for sharing your feedback.
          </motion.p>

          <motion.div
            initial={{
              opacity: 0,
              y: 12,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.36,
              duration: 0.55,
              ease: EASE,
            }}
            className="
              mt-5
              space-y-2
            "
          >
            <motion.button
              type="button"
              whileHover={{
                y: -2,
              }}
              whileTap={{
                scale: 0.985,
              }}
              onClick={goToEvent}
              className="
                h-10
                w-full
                cursor-pointer
                rounded-xl
                bg-primary
                text-[12px]
                font-semibold
                text-white
                shadow-[0_8px_22px_rgba(26,158,143,0.18)]
              "
            >
              Back to Event
            </motion.button>

            <motion.button
              type="button"
              whileHover={{
                y: -1,
              }}
              whileTap={{
                scale: 0.985,
              }}
              onClick={goToTickets}
              className="
                h-10
                w-full
                cursor-pointer
                rounded-xl
                border
                border-gray-200
                bg-white
                text-[11px]
                font-semibold
                text-gray-500
                transition-colors
                duration-300
                hover:border-gray-300
                hover:bg-gray-50
                hover:text-secondary
              "
            >
              Back to Ticket
            </motion.button>
          </motion.div>
        </motion.section>
      </main>
    );
  }

  /* ============================================================
     FEEDBACK PAGE
  ============================================================ */

  return (
    <motion.main
      variants={
        pageVariants
      }
      initial="hidden"
      animate="visible"
      className="
        relative
        flex
        flex-col
        items-center
        justify-center
        min-h-dvh
        overflow-hidden
        bg-[#07151F]/35
        backdrop-blur-[3px]
        px-3
        py-3
        sm:px-6
        sm:py-8
        md:bg-[#F7F9FB]
        md:px-4
        md:pb-8
        md:pt-8
        md:backdrop-blur-0
      "
    >
      <header
        className="
          relative
          z-20
          mx-auto
          mb-2
          md:mb-5
          flex
          w-full
          max-w-[920px]
          items-center
          justify-between
        "
      >
        <button
          type="button"
          onClick={() =>
            goBack()
          }
          className="
            inline-flex
            h-8
            items-center
            gap-1.5
            rounded-lg
            border
            border-gray-200
            bg-white
            px-2.5
            text-[10px]
            font-semibold
            text-secondary
            shadow-sm
            transition-colors
            hover:border-primary/30
            hover:text-primary
          "
        >
          <span aria-hidden="true">←</span>
          Back
        </button>

        <button
          type="button"
          onClick={goToEvents}
          className="
            text-[11px]
            font-semibold
            text-secondary
            hover:text-primary
          "
        >
          SSI Maya Connect
        </button>
      </header>

      <div
        className="
          pointer-events-none
          absolute
          left-[-180px]
          top-[-160px]
          h-[420px]
          w-[420px]
          rounded-full
          bg-primary/[0.025]
          blur-3xl
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          bottom-[-200px]
          right-[-180px]
          h-[430px]
          w-[430px]
          rounded-full
          bg-secondary/[0.025]
          blur-3xl
        "
      />

      <motion.section
        variants={
          itemVariants
        }
        className="
          relative
          z-10
          mx-auto
          w-full
          max-w-[calc(100vw-24px)]
          max-h-[calc(100dvh-24px)]
          overflow-y-auto
          rounded-[18px]
          border
          border-gray-200
          bg-white
          shadow-[0_20px_70px_rgba(6,19,29,0.22)]
          md:max-w-[920px]
          md:max-h-none
          md:overflow-hidden
          md:rounded-[26px]
          md:shadow-[0_16px_48px_rgba(27,75,107,0.065)]
          md:grid
          md:grid-cols-[0.9fr_1.1fr]
        "
      >
        {/* LEFT PANEL */}

        <div
          className="
            relative
            overflow-hidden
            bg-[#FAFCFC]
            px-4
            py-4
            sm:px-6
            sm:py-6
            md:border-b-0
            md:border-r
            md:px-8
            md:py-9
          "
        >
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.8,
              rotate: -5,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              rotate: 0,
            }}
            transition={{
              delay: 0.15,
              duration: 0.6,
              ease: EASE,
            }}
            className="
              grid
              h-9
              w-9
              place-items-center
              rounded-[15px]
              bg-primary/10
              text-primary
            "
          >
            <svg
              className="
                h-[18px]
                w-[18px]
                md:h-[22px]
                md:w-[22px]
              "
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 15h8M9 10h.01M15 10h.01"
              />

              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21a9 9 0 1 0-9-9c0 1.8.52 3.48 1.42 4.9L3 21l4.2-1.35A8.96 8.96 0 0 0 12 21z"
              />
            </svg>
          </motion.div>

          <motion.h1
            initial={{
              opacity: 0,
              y: 10,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.2,
              duration: 0.55,
              ease: EASE,
            }}
            className="
              mt-3
              font-heading
              text-[19px]
              font-bold
              tracking-[-0.03em]
              text-secondary
              sm:text-[22px]
              md:mt-5
              md:text-[26px]
              lg:text-[28px]
            "
          >
            {feedbackScope === 'application'
              ? 'How was your SSI Maya Connect experience?'
              : 'How was your event experience?'}
          </motion.h1>

          <motion.p
            initial={{
              opacity: 0,
              y: 8,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.25,
              duration: 0.55,
              ease: EASE,
            }}
            className="
              mt-1
              max-w-[360px]
              text-[11px]
              leading-4
              text-gray-500
              md:mt-2
              md:max-w-[360px]
              md:text-[13px]
              md:leading-6
            "
          >
            {feedbackScope === 'application'
              ? 'Your feedback helps us make booking and using SSI Maya Connect smoother.'
              : 'Tell us how the event experience felt and help us improve future programmes.'}
          </motion.p>

          {/* RATING */}

          <motion.div
            initial={{
              opacity: 0,
              y: 10,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.3,
              duration: 0.55,
              ease: EASE,
            }}
            className="
              mt-3
              md:mt-8
            "
          >
            <p
              className="
                text-[10px]
                font-bold
                uppercase
                tracking-[0.055em]
                text-gray-400
              "
            >
              Rate your experience
            </p>

            <div
              className="
                mt-2
                flex
                items-center
                gap-1
              "
              onMouseLeave={() =>
                setHoveredRating(
                  0,
                )
              }
            >
              {[1, 2, 3, 4, 5].map(
                (
                  value,
                ) => {
                  const active =
                    value <=
                    (
                      hoveredRating ||
                      rating
                    );

                  return (
                    <motion.button
                      key={
                        value
                      }
                      type="button"
                      aria-label={`${value} star${
                        value === 1
                          ? ''
                          : 's'
                      }`}
                      onMouseEnter={() =>
                        setHoveredRating(
                          value,
                        )
                      }
                      onClick={() =>
                        setRating(
                          value,
                        )
                      }
                      whileHover={{
                        y: -3,
                        scale: 1.12,
                      }}
                      whileTap={{
                        scale: 0.9,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 380,
                        damping: 22,
                      }}
                      className="
                        cursor-pointer
                        rounded-lg
                        p-0.5
                        md:p-1
                      "
                    >
                      <StarIcon
                        active={
                          active
                        }
                      />
                    </motion.button>
                  );
                },
              )}
            </div>

            <div
              className="
                mt-1
                min-h-[16px]
              "
            >
              <AnimatePresence
                mode="wait"
              >
                {rating >
                  0 && (
                  <motion.p
                    key={
                      rating
                    }
                    initial={{
                      opacity: 0,
                      y: 6,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    exit={{
                      opacity: 0,
                      y: -4,
                    }}
                    transition={{
                      duration: 0.25,
                      ease: EASE,
                    }}
                    className="
                      text-[10px]
                      font-medium
                      text-gray-500
                    "
                  >
                    {getRatingText(
                      rating,
                    )}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          <motion.div
            initial={{
              opacity: 0,
              y: 8,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.36,
              duration: 0.55,
              ease: EASE,
            }}
            className="
              mt-3
              md:mt-7
              flex
              items-start
              gap-2
              rounded-xl
              bg-primary/[0.045]
              px-3
              py-2
              md:rounded-[14px]
              md:px-4
              md:py-3
            "
          >
            <svg
              className="
                mt-0.5
                h-3.5
                w-3.5
                shrink-0
                text-primary
              "
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.9}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3 5 6v5c0 4.5 2.9 8.6 7 10 4.1-1.4 7-5.5 7-10V6l-7-3Z"
              />

              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m9.5 12 1.7 1.7 3.4-3.7"
              />
            </svg>

            <p
              className="
                text-[9px]
                leading-4
                text-gray-500
                md:text-[10px]
                md:leading-[17px]
              "
            >
              Feedback is completely optional. You can return
              to your booking whenever you like.
            </p>
          </motion.div>
        </div>

        {/* RIGHT PANEL */}

        <motion.div
          initial={{
            opacity: 0,
            x: 18,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
          transition={{
            delay: 0.2,
            duration: 0.6,
            ease: EASE,
          }}
          className="
            px-4
            py-4
            sm:px-6
            sm:py-6
            md:px-8
            md:py-9
          "
        >
          <div>
            <label
              htmlFor="feedback-message"
              className="
                text-[10px]
                font-bold
                uppercase
                tracking-[0.055em]
                text-gray-400
              "
            >
              What could we improve?

              <span
                className="
                  ml-1
                  normal-case
                  tracking-normal
                  text-gray-300
                "
              >
                Optional
              </span>
            </label>

            <textarea
              id="feedback-message"
              value={
                message
              }
              onChange={(
                event,
              ) =>
                setMessage(
                  event.target.value,
                )
              }
              rows={5}
              maxLength={500}
              placeholder="Tell us anything that could make your experience better..."
              className="
                mt-2
                min-h-[100px]
                md:min-h-[132px]
                w-full
                resize-none
                rounded-[14px]
                border
                border-gray-200
                bg-[#FAFBFC]
                px-3
                py-2.5
                text-[11px]
                leading-4
                md:px-4
                md:py-3.5
                md:text-[12px]
                md:leading-5
                text-secondary
                outline-none
                transition-all
                duration-300
                placeholder:text-gray-400
                hover:border-gray-300
                focus:border-primary/45
                focus:bg-white
                focus:ring-4
                focus:ring-primary/[0.07]
              "
            />

            <p
              className="
                mt-1.5
                text-right
                text-[9px]
                text-gray-300
              "
            >
              {message.length}/500
            </p>
          </div>

          <div
            className="
              mt-3
              md:mt-5
            "
          >
            <label
              htmlFor="feature-suggestion"
              className="
                text-[10px]
                font-bold
                uppercase
                tracking-[0.055em]
                text-gray-400
              "
            >
              Suggest a feature

              <span
                className="
                  ml-1
                  normal-case
                  tracking-normal
                  text-gray-300
                "
              >
                Optional
              </span>
            </label>

            <input
              id="feature-suggestion"
              type="text"
              value={
                suggestedFeature
              }
              onChange={(
                event,
              ) =>
                setSuggestedFeature(
                  event.target.value,
                )
              }
              maxLength={200}
              placeholder="Example: calendar reminders, easier ticket access..."
              className="
                mt-2
                h-10
                md:h-12
                w-full
                rounded-[14px]
                border
                border-gray-200
                bg-[#FAFBFC]
                px-3
                text-[11px]
                md:px-4
                md:text-[12px]
                text-secondary
                outline-none
                transition-all
                duration-300
                placeholder:text-gray-400
                hover:border-gray-300
                focus:border-primary/45
                focus:bg-white
                focus:ring-4
                focus:ring-primary/[0.07]
              "
            />
          </div>

          <motion.div
            initial={{
              opacity: 0,
              y: 12,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 0.36,
              duration: 0.55,
              ease: EASE,
            }}
            className="
              mt-3
              md:mt-7
              space-y-2.5
            "
          >
            <motion.button
              type="button"
              whileHover={{
                y: -2,
              }}
              whileTap={{
                scale: 0.985,
              }}
              onClick={
                handleSubmit
              }
              className="
                h-10
                md:h-12
                w-full
                cursor-pointer
                rounded-xl
                bg-primary
                text-[12px]
                md:text-[13px]
                font-semibold
                text-white
                shadow-[0_8px_20px_rgba(26,158,143,0.17)]
              "
            >
              Submit Feedback
            </motion.button>

            {submitError && (
              <p
                role="alert"
                className="
                  text-center
                  text-[11px]
                  font-medium
                  text-red-600
                "
              >
                {submitError}
              </p>
            )}

            <motion.button
              type="button"
              whileHover={{
                y: -1,
              }}
              whileTap={{
                scale: 0.985,
              }}
              onClick={
                handleMaybeLater
              }
              className="
                h-11
                w-full
                cursor-pointer
                rounded-xl
                border
                border-gray-200
                bg-white
                text-[12px]
                font-semibold
                text-gray-500
                transition-colors
                duration-300
                hover:border-gray-300
                hover:bg-gray-50
                hover:text-secondary
              "
            >
              Maybe Later
            </motion.button>
          </motion.div>
        </motion.div>
      </motion.section>
    </motion.main>
  );
}

/* ============================================================
   STAR ICON
============================================================ */

function StarIcon({
  active,
}: {
  active:
    boolean;
}) {
  return (
    <motion.svg
      animate={{
        fill:
          active
            ? '#F5B544'
            : 'rgba(0,0,0,0)',

        color:
          active
            ? '#F5B544'
            : '#D1D5DB',
      }}
      transition={{
        duration: 0.2,
        ease: EASE,
      }}
      className="
        h-8
        w-8

        sm:h-9
        sm:w-9
      "
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.7}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m12 3 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.92 1.06-6.2L3 9.53l6.22-.9L12 3z"
      />
    </motion.svg>
  );
}

/* ============================================================
   RATING TEXT
============================================================ */

function getRatingText(
  rating:
    number,
) {
  switch (
    rating
  ) {
    case 1:
      return 'Needs improvement';

    case 2:
      return 'Fair';

    case 3:
      return 'Good';

    case 4:
      return 'Very good';

    case 5:
      return 'Excellent';

    default:
      return '';
  }
}