'use client';

import type {
  ReactNode,
} from 'react';

import Image from 'next/image';

import {
  usePathname,
  useRouter,
} from 'next/navigation';

import {
  useEffect,
  useState,
} from 'react';

import {
  AnimatePresence,
  motion,
} from 'framer-motion';

import Sidebar from '@/components/admin/Sidebar';

import {
  getAdminTokenPayload,
  hasAdminPermission,
  type AdminPermission,
} from '@/lib/admin-auth';

const PERMISSION_ROUTES: Record<AdminPermission, string> = {
  dashboard: '/admin/landing',
  events: '/admin/eventmanagement',
  bookings: '/admin/bookings',
  'check-in': '/admin/check-in',
  reports: '/admin/reports',
  auth: '/admin/auth',
};

function getRequiredPermissionForPath(path: string): AdminPermission | null {
  if (path === '/admin/landing') return 'dashboard';
  if (path.startsWith('/admin/eventmanagement')) return 'events';
  if (path.startsWith('/admin/bookings')) return 'bookings';
  if (path.startsWith('/admin/check-in')) return 'check-in';
  if (path.startsWith('/admin/reports')) return 'reports';
  if (path.startsWith('/admin/auth')) return 'auth';
  return null;
}

/* ============================================================
   LAYOUT
============================================================ */

export default function AdminLayout({
  children,
}: {
  children:
    ReactNode;
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

  /* ==========================================================
     AUTH & PERMISSION CHECK
  ========================================================== */

  useEffect(() => {
    if (
      pathname ===
        '/admin' ||
      pathname ===
        '/admin/login'
    ) {
      setAuthChecked(
        true,
      );

      return;
    }

    setAuthChecked(
      false,
    );

    const payload =
      getAdminTokenPayload();

    if (!payload) {
      router.replace(
        '/admin/login',
      );

      return;
    }

    // Check permission for current route
    const requiredPermission = getRequiredPermissionForPath(pathname);
    if (requiredPermission && !hasAdminPermission(payload, requiredPermission)) {
      // User is not authorized for this specific feature; redirect to first allowed route
      const firstAllowed = Object.entries(PERMISSION_ROUTES).find(([perm]) =>
        hasAdminPermission(payload, perm as AdminPermission),
      );

      if (firstAllowed && firstAllowed[1] !== pathname) {
        router.replace(firstAllowed[1]);
        return;
      }
    }

    setAuthChecked(
      true,
    );
  }, [
    pathname,
    router,
  ]);

  /* ==========================================================
     CLOSE DRAWER ON ROUTE CHANGE
  ========================================================== */

  useEffect(() => {
    setMobileSidebarOpen(
      false,
    );
  }, [
    pathname,
  ]);

  /* ==========================================================
     LOCK BODY
  ========================================================== */

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

  /* ==========================================================
     ESCAPE
  ========================================================== */

  useEffect(() => {
    function handleKeyDown(
      event:
        KeyboardEvent,
    ) {
      if (
        event.key ===
          'Escape'
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
  }, []);

  /* ==========================================================
     CLOSE DRAWER WHEN DESKTOP IS REACHED
  ========================================================== */

  useEffect(() => {
    const media =
      window.matchMedia(
        '(min-width: 1024px)',
      );

    function handleChange(
      event:
        MediaQueryListEvent,
    ) {
      if (
        event.matches
      ) {
        setMobileSidebarOpen(
          false,
        );
      }
    }

    media.addEventListener(
      'change',
      handleChange,
    );

    return () => {
      media.removeEventListener(
        'change',
        handleChange,
      );
    };
  }, []);

  /* ==========================================================
     LOGIN
  ========================================================== */

  if (
    pathname ===
      '/admin' ||
    pathname ===
      '/admin/login'
  ) {
    return children;
  }

  /* ==========================================================
     AUTH LOADER
  ========================================================== */

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

  /* ==========================================================
     APP
  ========================================================== */

  return (
    <div
      className="
        min-h-dvh
        w-full
        bg-gray-50
      "
    >
      {/* ======================================================
          DESKTOP SIDEBAR

          Only permanent from lg upward.
      ====================================================== */}

      <aside
        className="
          fixed
          inset-y-0
          left-0
          z-40

          hidden

          w-[248px]

          border-r
          border-gray-200

          bg-white

          lg:block

          xl:w-[256px]
        "
      >
        <Sidebar />
      </aside>

      {/* ======================================================
          MOBILE / TABLET HEADER
      ====================================================== */}

      <header
        className="
          fixed
          inset-x-0
          top-0
          z-50

          flex
          h-[64px]

          items-center
          justify-between

          border-b
          border-gray-200

          bg-white/95

          px-3

          shadow-[0_1px_8px_rgba(27,75,107,0.035)]

          backdrop-blur-xl

          min-[390px]:px-4

          sm:px-5

          lg:hidden
        "
      >
        {/* BRAND */}

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

          <div
            className="
              min-w-0
              text-left
            "
          >
            <p
              className="
                truncate

                font-heading

                text-[13px]
                font-bold

                tracking-[-0.02em]

                text-secondary

                min-[360px]:text-[14px]
              "
            >
              SSI Maya Connect
            </p>

            <p
              className="
                hidden

                text-[9px]
                font-medium

                text-gray-400

                min-[430px]:block
              "
            >
              Admin Portal
            </p>
          </div>
        </button>

        {/* MENU */}

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
            shrink-0

            cursor-pointer
            place-items-center

            rounded-lg

            border
            border-gray-200

            bg-white

            text-secondary

            shadow-sm

            transition-all

            hover:border-primary/30
            hover:bg-primary/[0.04]

            active:scale-95
          "
        >
          <MenuIcon />
        </button>
      </header>

      {/* ======================================================
          MOBILE / TABLET DRAWER
      ====================================================== */}

      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            {/* BACKDROP */}

            <motion.button
              type="button"
              aria-label="Close navigation"
              initial={{
                opacity:
                  0,
              }}
              animate={{
                opacity:
                  1,
              }}
              exit={{
                opacity:
                  0,
              }}
              transition={{
                duration:
                  0.18,
              }}
              onClick={() =>
                setMobileSidebarOpen(
                  false,
                )
              }
              className="
                fixed
                inset-0
                z-[70]

                cursor-default

                bg-secondary/25

                backdrop-blur-[2px]

                lg:hidden
              "
            />

            {/* DRAWER */}

            <motion.aside
              initial={{
                x:
                  '-100%',
              }}
              animate={{
                x:
                  0,
              }}
              exit={{
                x:
                  '-100%',
              }}
              transition={{
                type:
                  'spring',

                stiffness:
                  380,

                damping:
                  36,

                mass:
                  0.9,
              }}
              className="
                fixed
                inset-y-0
                left-0
                z-[80]

                w-[min(86vw,310px)]

                overflow-hidden

                border-r
                border-gray-200

                bg-white

                shadow-[18px_0_45px_rgba(27,75,107,0.16)]

                lg:hidden
              "
            >
              {/* CLOSE */}

              <button
                type="button"
                aria-label="Close navigation"
                onClick={() =>
                  setMobileSidebarOpen(
                    false,
                  )
                }
                className="
                  absolute
                  right-3
                  top-3
                  z-[90]

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

                  shadow-sm

                  transition-all

                  hover:bg-gray-50
                  hover:text-secondary

                  active:scale-95
                "
              >
                <CloseIcon />
              </button>

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

      {/* ======================================================
          MAIN
      ====================================================== */}

      <main
        className="
          min-h-dvh
          min-w-0

          pt-[64px]

          lg:ml-[248px]
          lg:pt-0

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

            lg:px-7
            lg:py-7

            xl:px-9
            xl:py-8

            2xl:px-10
          "
        >
          {children}
        </div>
      </main>
    </div>
  );
}

/* ============================================================
   ICONS
============================================================ */

function MenuIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        d="M4 7h16M4 12h16M4 17h16"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        d="m6 6 12 12M18 6 6 18"
      />
    </svg>
  );
}

