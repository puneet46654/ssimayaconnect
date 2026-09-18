'use client';

import Sidebar from '@/components/admin/Sidebar';

import {
  usePathname,
  useRouter,
} from 'next/navigation';

import {
  useEffect,
  useState,
} from 'react';

import Image from 'next/image';

import {
  AnimatePresence,
  motion,
} from 'framer-motion';

import {
  getAdminTokenPayload,
} from '@/lib/admin-auth';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname =
    usePathname();

  const router =
    useRouter();

  const [
    authChecked,
    setAuthChecked,
  ] = useState(false);

  const [
    mobileSidebarOpen,
    setMobileSidebarOpen,
  ] = useState(false);

  /*
  |--------------------------------------------------------------------------
  | AUTH CHECK
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (
      pathname === '/admin' ||
      pathname === '/admin/login'
    ) {
      void Promise.resolve().then(() =>
        setAuthChecked(true),
      );

      return;
    }

    void Promise.resolve().then(() =>
      setAuthChecked(false),
    );

    const payload =
      getAdminTokenPayload();

    if (!payload) {
      router.replace(
        '/admin/login',
      );

      return;
    }

    void Promise.resolve().then(() =>
      setAuthChecked(true),
    );
  }, [
    pathname,
    router,
  ]);

  /*
  |--------------------------------------------------------------------------
  | CLOSE MOBILE SIDEBAR AFTER ROUTE CHANGE
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    setMobileSidebarOpen(
      false,
    );
  }, [
    pathname,
  ]);

  /*
  |--------------------------------------------------------------------------
  | LOCK BODY WHILE MOBILE DRAWER IS OPEN
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (
      !mobileSidebarOpen
    ) {
      document.body.style.overflow =
        '';

      return;
    }

    document.body.style.overflow =
      'hidden';

    return () => {
      document.body.style.overflow =
        '';
    };
  }, [
    mobileSidebarOpen,
  ]);

  /*
  |--------------------------------------------------------------------------
  | ESCAPE KEY
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key ===
          'Escape' &&
        mobileSidebarOpen
      ) {
        setMobileSidebarOpen(
          false,
        );
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [
    mobileSidebarOpen,
  ]);

  /*
  |--------------------------------------------------------------------------
  | LOGIN PAGE
  |--------------------------------------------------------------------------
  */

  if (
    pathname === '/admin' ||
    pathname === '/admin/login'
  ) {
    return children;
  }

  /*
  |--------------------------------------------------------------------------
  | AUTH LOADER
  |--------------------------------------------------------------------------
  */

  if (!authChecked) {
    return (
      <div
        className="
          grid
          min-h-dvh
          place-items-center
          bg-gray-50
          px-4
        "
      >
        <div
          className="
            flex
            flex-col
            items-center
            gap-3
          "
        >
          <span
            className="
              h-7
              w-7
              animate-spin
              rounded-full
              border-[3px]
              border-primary/15
              border-t-primary
            "
          />

          <p
            className="
              text-sm
              font-medium
              text-gray-500
            "
          >
            Checking admin session...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="
        min-h-dvh
        w-full
        bg-gray-50
      "
    >
      {/* =====================================================
          DESKTOP SIDEBAR
      ===================================================== */}

      <aside
        className="
          fixed
          inset-y-0
          left-0
          z-40
          hidden

          w-[232px]

          border-r
          border-gray-200

          bg-white

          md:block

          lg:w-[248px]

          xl:w-[256px]
        "
      >
        <Sidebar />
      </aside>

      {/* =====================================================
          MOBILE / TABLET HEADER
      ===================================================== */}

      <header
        className="
          fixed
          inset-x-0
          top-0
          z-40

          flex
          h-[64px]
          items-center
          justify-between

          border-b
          border-gray-200

          bg-white/95

          px-4

          backdrop-blur-xl

          sm:px-5

          md:hidden
        "
      >
        <button
          type="button"
          onClick={() =>
            router.push(
              '/admin/landing',
            )
          }
          className="
            flex
            min-w-0
            cursor-pointer
            items-center
            gap-2.5

            rounded-lg

            transition
            active:scale-[0.98]
          "
        >
          <span
            className="
              grid
              h-9
              w-9
              shrink-0
              place-items-center

              rounded-lg

              border
              border-primary/15

              bg-primary/[0.05]
            "
          >
            <Image
              src="/logos/ssilogo.png"
              alt="SSI"
              width={25}
              height={25}
              priority
              className="
                h-[25px]
                w-[25px]
                object-contain
              "
            />
          </span>

          <span
            className="
              truncate
              font-heading
              text-[14px]
              font-bold
              tracking-[-0.02em]
              text-secondary
            "
          >
            SSI Maya Connect
          </span>
        </button>

        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={
            mobileSidebarOpen
          }
          onClick={() =>
            setMobileSidebarOpen(
              true,
            )
          }
          className="
            grid
            h-10
            w-10
            cursor-pointer
            place-items-center

            rounded-lg

            border
            border-gray-200

            bg-white

            text-secondary

            transition-all
            duration-200

            hover:border-gray-300
            hover:bg-gray-50

            active:scale-95
          "
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 7h16M4 12h16M4 17h16"
            />
          </svg>
        </button>
      </header>

      {/* =====================================================
          MOBILE DRAWER
      ===================================================== */}

      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            {/* BACKDROP */}

            <motion.button
              type="button"
              aria-label="Close navigation"
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
              }}
              exit={{
                opacity: 0,
              }}
              transition={{
                duration: 0.2,
              }}
              onClick={() =>
                setMobileSidebarOpen(
                  false,
                )
              }
              className="
                fixed
                inset-0
                z-[60]

                cursor-default

                bg-secondary/20

                backdrop-blur-[2px]

                md:hidden
              "
            />

            {/* DRAWER */}

            <motion.aside
              initial={{
                x: '-100%',
              }}
              animate={{
                x: 0,
              }}
              exit={{
                x: '-100%',
              }}
              transition={{
                type: 'spring',
                stiffness: 360,
                damping: 34,
                mass: 0.9,
              }}
              className="
                fixed
                bottom-0
                left-0
                top-0
                z-[70]

                w-[min(86vw,300px)]

                overflow-hidden

                border-r
                border-gray-200

                bg-white

                shadow-[18px_0_45px_rgba(27,75,107,0.12)]

                md:hidden
              "
            >
              <div
                className="
                  absolute
                  right-3
                  top-3
                  z-50
                "
              >
                <button
                  type="button"
                  aria-label="Close navigation"
                  onClick={() =>
                    setMobileSidebarOpen(
                      false,
                    )
                  }
                  className="
                    grid
                    h-9
                    w-9
                    cursor-pointer
                    place-items-center

                    rounded-lg

                    border
                    border-gray-200

                    bg-white

                    text-gray-500

                    transition

                    hover:bg-gray-50
                    hover:text-secondary

                    active:scale-95
                  "
                >
                  <svg
                    className="h-4.5 w-4.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <Sidebar
                mobile
                onNavigate={() =>
                  setMobileSidebarOpen(
                    false,
                  )
                }
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <main
        className="
          min-h-dvh
          min-w-0

          pt-[64px]

          md:ml-[232px]
          md:pt-0

          lg:ml-[248px]

          xl:ml-[256px]
        "
      >
        <div
          className="
            mx-auto
            w-full
            max-w-[1600px]

            px-3
            py-4

            min-[390px]:px-4

            sm:px-5
            sm:py-5

            md:px-6
            md:py-6

            lg:px-8
            lg:py-7

            xl:px-10
            xl:py-8

            2xl:px-12
            2xl:py-9
          "
        >
          {children}
        </div>
      </main>
    </div>
  );
}