'use client';

import Link from 'next/link';

import {
  usePathname,
  useRouter,
} from 'next/navigation';

import Image from 'next/image';

import {
  AnimatePresence,
  motion,
} from 'framer-motion';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ADMIN_TOKEN_KEY,
  clearAdminSession,
  decodeAdminToken,
} from '@/lib/admin-auth';

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

const navItems = [
  {
    name: 'Dashboard',
    href: '/admin/landing',

    icon:
      'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001 1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },

  {
    name: 'Events Management',
    href: '/admin/eventmanagement',

    icon:
      'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },

  {
    name: 'Bookings',
    href: '/admin/bookings',

    icon:
      'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },

  {
    name: 'Attendees',
    href: '/admin/attendees',

    icon:
      'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  },

  {
    name: 'Check-in',
    href: '/admin/check-in',

    icon:
      'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },

  {
    name: 'Reports & Export',
    href: '/admin/reports',

    icon:
      'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
];

function formatUsername(
  username: string,
) {
  if (!username) {
    return '';
  }

  return (
    username
      .charAt(0)
      .toUpperCase() +
    username.slice(1)
  );
}

function getInitials(
  username: string,
) {
  if (!username) {
    return '';
  }

  return username
    .slice(0, 2)
    .toUpperCase();
}

export default function Sidebar({
  mobile = false,
  onNavigate,
}: SidebarProps) {
  const pathname =
    usePathname();

  const router =
    useRouter();

  const [
    currentUser,
    setCurrentUser,
  ] = useState<
    ReturnType<
      typeof decodeAdminToken
    >
  >(null);

  const [
    showLogoutModal,
    setShowLogoutModal,
  ] =
    useState(false);

  const [
    loggingOut,
    setLoggingOut,
  ] =
    useState(false);

  /*
  |--------------------------------------------------------------------------
  | LOAD CURRENT ADMIN
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const token =
      localStorage.getItem(
        ADMIN_TOKEN_KEY,
      );

    if (!token) {
      router.replace(
        '/admin/login',
      );

      return;
    }

    const payload =
      decodeAdminToken(
        token,
      );

    if (!payload) {
      localStorage.removeItem(
        ADMIN_TOKEN_KEY,
      );

      router.replace(
        '/admin/login',
      );

      return;
    }

    void Promise.resolve().then(
      () =>
        setCurrentUser(
          payload,
        ),
    );
  }, [
    router,
  ]);

  const displayName =
    useMemo(() => {
      if (!currentUser) {
        return '';
      }

      return formatUsername(
        currentUser.username,
      );
    }, [
      currentUser,
    ]);

  const initials =
    useMemo(() => {
      if (!currentUser) {
        return '';
      }

      return getInitials(
        currentUser.username,
      );
    }, [
      currentUser,
    ]);

  function isActiveRoute(
    href: string,
  ) {
    if (
      href ===
      '/admin/landing'
    ) {
      return (
        pathname ===
        href
      );
    }

    return (
      pathname === href ||
      pathname.startsWith(
        `${href}/`,
      )
    );
  }

  function handleNavigation() {
    if (
      onNavigate
    ) {
      onNavigate();
    }
  }

  async function handleLogout() {
    if (
      loggingOut
    ) {
      return;
    }

    setLoggingOut(
      true,
    );

    await new Promise(
      (resolve) => {
        window.setTimeout(
          resolve,
          400,
        );
      },
    );

    clearAdminSession();
    await fetch('/api/admin/logout', {
      method: 'POST',
    });

    setCurrentUser(
      null,
    );

    setShowLogoutModal(
      false,
    );

    if (
      onNavigate
    ) {
      onNavigate();
    }

    router.replace(
      '/admin/login',
    );

    router.refresh();
  }

  return (
    <>
      <aside
        className={`
          flex
          h-full
          min-h-0
          w-full
          flex-col

          bg-white

          ${
            mobile
              ? ''
              : `
                sticky
                top-0
                h-screen
              `
          }
        `}
      >
        {/* =====================================================
            BRAND
        ===================================================== */}

        <div
          className={`
            shrink-0

            px-4
            pb-4

            ${
              mobile
                ? 'pt-4 pr-14'
                : 'pt-5 lg:px-5 lg:pt-6'
            }
          `}
        >
          <Link
            href="/admin/landing"
            onClick={
              handleNavigation
            }
            className="
              group

              flex
              cursor-pointer
              items-center

              gap-3

              rounded-xl

              px-2
              py-2

              transition-colors
              duration-200

              hover:bg-gray-50

              active:scale-[0.99]
            "
          >
            <div
              className="
                grid
                h-10
                w-10
                shrink-0
                place-items-center

                rounded-xl

                border
                border-primary/15

                bg-primary/[0.05]

                transition-colors

                group-hover:border-primary/25
                group-hover:bg-primary/[0.08]
              "
            >
              <Image
                src="/logos/ssilogo.png"
                alt="SSI"
                width={28}
                height={28}
                priority
                className="
                  h-7
                  w-7
                  object-contain
                "
              />
            </div>

            <div
              className="
                min-w-0
                flex-1
              "
            >
              <p
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
              </p>
            </div>
          </Link>
        </div>

        <div
          className="
            mx-4
            h-px
            shrink-0
            bg-gray-100

            lg:mx-5
          "
        />

        {/* =====================================================
            NAVIGATION
        ===================================================== */}

        <nav
          className="
            min-h-0
            flex-1

            overflow-y-auto
            overscroll-contain

            px-3
            py-4

            [scrollbar-width:thin]

            lg:px-4
            lg:py-5
          "
        >
          <div
            className="
              space-y-1
              lg:space-y-1.5
            "
          >
            {navItems.map(
              (item) => {
                const active =
                  isActiveRoute(
                    item.href,
                  );

                return (
                  <Link
                    key={
                      item.name
                    }
                    href={
                      item.href
                    }
                    onClick={
                      handleNavigation
                    }
                    className={`
                      group
                      relative

                      flex
                      cursor-pointer
                      items-center

                      gap-2.5

                      overflow-hidden

                      rounded-xl

                      px-3
                      py-2.5

                      text-[13px]
                      font-medium

                      transition-all
                      duration-200

                      lg:gap-3
                      lg:px-3.5
                      lg:py-3
                      lg:text-sm

                      ${
                        active
                          ? `
                            bg-primary/[0.07]
                            text-primary
                          `
                          : `
                            text-gray-500

                            hover:bg-gray-50
                            hover:text-secondary
                          `
                      }
                    `}
                  >
                    {/* ACTIVE LINE */}

                    <span
                      className={`
                        absolute
                        bottom-2
                        left-0
                        top-2

                        w-[3px]

                        rounded-r-full

                        bg-primary

                        transition-all
                        duration-200

                        ${
                          active
                            ? `
                              scale-y-100
                              opacity-100
                            `
                            : `
                              scale-y-50
                              opacity-0
                            `
                        }
                      `}
                    />

                    {/* ICON */}

                    <span
                      className={`
                        grid

                        h-8
                        w-8

                        shrink-0

                        place-items-center

                        rounded-lg

                        transition-colors
                        duration-200

                        ${
                          active
                            ? `
                              text-primary
                            `
                            : `
                              text-gray-400

                              group-hover:text-secondary
                            `
                        }
                      `}
                    >
                      <svg
                        className="
                          h-[18px]
                          w-[18px]
                        "
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.9}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d={
                            item.icon
                          }
                        />
                      </svg>
                    </span>

                    <span
                      className="
                        min-w-0
                        flex-1
                        truncate
                      "
                    >
                      {item.name}
                    </span>
                  </Link>
                );
              },
            )}
          </div>
        </nav>

        {/* =====================================================
            USER + LOGOUT
        ===================================================== */}

        <div
          className="
            shrink-0

            border-t
            border-gray-100

            bg-white

            p-3

            lg:p-4
          "
        >
          {currentUser && (
            <div
              className="
                mb-2.5

                flex
                min-w-0
                items-center

                gap-3

                rounded-xl

                bg-gray-50

                p-2.5

                lg:mb-3
                lg:p-3
              "
            >
              <div
                className="
                  grid

                  h-9
                  w-9

                  shrink-0

                  place-items-center

                  rounded-full

                  bg-primary

                  text-[11px]
                  font-bold
                  text-white

                  lg:h-10
                  lg:w-10
                  lg:text-xs
                "
              >
                {initials}
              </div>

              <div
                className="
                  min-w-0
                  flex-1
                "
              >
                <p
                  className="
                    truncate

                    text-[13px]
                    font-semibold

                    text-secondary

                    lg:text-sm
                  "
                >
                  {displayName}
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() =>
              setShowLogoutModal(
                true,
              )
            }
            className="
              group

              flex
              w-full

              cursor-pointer
              items-center

              gap-2.5

              rounded-xl

              px-3
              py-2.5

              text-[13px]
              font-medium

              text-gray-500

              transition-colors
              duration-200

              hover:bg-red-50
              hover:text-red-600

              lg:gap-3
              lg:text-sm
            "
          >
            <span
              className="
                grid

                h-8
                w-8

                shrink-0

                place-items-center

                rounded-lg
              "
            >
              <svg
                className="
                  h-[18px]
                  w-[18px]
                "
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.9}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </span>

            <span>
              Log out
            </span>
          </button>
        </div>
      </aside>

      {/* =====================================================
          LOGOUT MODAL
      ===================================================== */}

      <AnimatePresence>
        {showLogoutModal && (
          <motion.div
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
              duration: 0.18,
            }}
            onMouseDown={(
              event,
            ) => {
              if (
                event.target ===
                  event.currentTarget &&
                !loggingOut
              ) {
                setShowLogoutModal(
                  false,
                );
              }
            }}
            className="
              fixed
              inset-0
              z-[200]

              flex
              items-end
              justify-center

              bg-secondary/25

              px-3
              pb-3

              backdrop-blur-[4px]

              sm:items-center
              sm:px-4
              sm:pb-0
            "
          >
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.97,
                y: 20,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.98,
                y: 12,
              }}
              transition={{
                type:
                  'spring',

                stiffness:
                  380,

                damping:
                  30,
              }}
              className="
                w-full
                max-w-[370px]

                rounded-[20px]

                border
                border-gray-200

                bg-white

                p-5

                shadow-[0_22px_70px_rgba(27,75,107,0.18)]

                sm:p-6
              "
            >
              <div
                className="
                  grid
                  h-10
                  w-10
                  place-items-center

                  rounded-xl

                  bg-red-50

                  text-red-500
                "
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.9}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </div>

              <h2
                className="
                  mt-4

                  font-heading

                  text-lg
                  font-bold

                  text-secondary
                "
              >
                Log out?
              </h2>

              <p
                className="
                  mt-1.5

                  text-sm
                  leading-6

                  text-gray-500
                "
              >
                Are you sure you want
                to log out
                {displayName
                  ? ` ${displayName}?`
                  : '?'}
              </p>

              <div
                className="
                  mt-5

                  grid
                  grid-cols-2

                  gap-2.5
                "
              >
                <button
                  type="button"
                  disabled={
                    loggingOut
                  }
                  onClick={() =>
                    setShowLogoutModal(
                      false,
                    )
                  }
                  className="
                    inline-flex
                    h-10

                    cursor-pointer

                    items-center
                    justify-center

                    rounded-lg

                    border
                    border-gray-200

                    bg-white

                    px-4

                    text-sm
                    font-semibold

                    text-gray-600

                    transition

                    hover:bg-gray-50
                    hover:text-secondary

                    active:scale-[0.98]

                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={
                    loggingOut
                  }
                  onClick={() =>
                    void handleLogout()
                  }
                  className="
                    inline-flex
                    h-10

                    cursor-pointer

                    items-center
                    justify-center

                    gap-2

                    rounded-lg

                    bg-red-500

                    px-4

                    text-sm
                    font-semibold

                    text-white

                    transition-colors

                    hover:bg-red-600

                    active:scale-[0.98]

                    disabled:cursor-not-allowed
                    disabled:opacity-70
                  "
                >
                  {loggingOut ? (
                    <>
                      <span
                        className="
                          h-4
                          w-4

                          animate-spin

                          rounded-full

                          border-2
                          border-white/30
                          border-t-white
                        "
                      />

                      <span className="hidden min-[360px]:inline">
                        Logging out
                      </span>
                    </>
                  ) : (
                    'Log out'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}