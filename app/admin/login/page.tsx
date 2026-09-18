'use client';

import {
  AnimatePresence,
  motion,
  Variants,
} from 'framer-motion';

import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
} from 'lucide-react';

import {
  FormEvent,
  useEffect,
  useState,
} from 'react';

import { useRouter } from 'next/navigation';
import {
  ADMIN_TOKEN_KEY,
  getAdminTokenPayload,
} from '@/lib/admin-auth';

type LoginState =
  | 'idle'
  | 'loading'
  | 'success';

type AdminTokenPayload = {
  username: string;
  loggedInAt: number;
};

const USERS: Record<string, string> = {
  puneet: 'puneet@ssi',
  naveen: 'naveen@ssi',
  rohan: 'rohan@ssi',
  anand: 'anand@ssi',
};

const LOGO_SRC =
  '/logos/ssilogo.png';

const PREMIUM_EASE: [
  number,
  number,
  number,
  number,
] = [0.16, 1, 0.3, 1];

const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 16,
  },

  visible: {
    opacity: 1,
    y: 0,

    transition: {
      duration: 0.52,
      ease: PREMIUM_EASE,
    },
  },
};

const formVariants: Variants = {
  hidden: {},

  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.18,
    },
  },
};

function createAdminToken(
  username: string,
) {
  const payload: AdminTokenPayload = {
    username,
    loggedInAt: Date.now(),
  };

  return btoa(
    encodeURIComponent(
      JSON.stringify(payload),
    ),
  );
}

export default function AdminLoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (getAdminTokenPayload()) {
      router.replace('/admin/landing');
    }
  }, [router]);

  const [
    credentials,
    setCredentials,
  ] = useState({
    username: '',
    password: '',
  });

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [error, setError] =
    useState('');

  const [
    loginState,
    setLoginState,
  ] =
    useState<LoginState>('idle');

  const isInteracting =
    loginState === 'loading' ||
    loginState === 'success';

  function handleInputChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const {
      name,
      value,
    } = event.target;

    setCredentials(
      (current) => ({
        ...current,
        [name]: value,
      }),
    );

    if (error) {
      setError('');
    }
  }

  async function handleLogin(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (isInteracting) {
      return;
    }

    setError('');

    const username =
      credentials.username
        .trim()
        .toLowerCase();

    const password =
      credentials.password;

    if (
      !username ||
      !password
    ) {
      setError(
        'Enter your login ID and password.',
      );

      return;
    }

    setLoginState('loading');

    await new Promise(
      (resolve) => {
        window.setTimeout(
          resolve,
          950,
        );
      },
    );

    const validPassword =
      USERS[username];

    if (
      !validPassword ||
      validPassword !== password
    ) {
      setLoginState('idle');

      setError(
        'Invalid login ID or password.',
      );

      return;
    }

    const token =
      createAdminToken(
        username,
      );

    localStorage.setItem(
      ADMIN_TOKEN_KEY,
      token,
    );

    setLoginState('success');

    window.setTimeout(
      () => {
        router.replace(
          '/admin/landing',
        );

        router.refresh();
      },
      750,
    );
  }

  return (
    <motion.div
      variants={formVariants}
      initial="hidden"
      animate="visible"
      className="
        mx-auto
        w-full
        max-w-[390px]
      "
    >
      {/* Mobile logo */}
      <motion.div
        variants={itemVariants}
        className="
          mb-9
          flex
          flex-col
          items-center
          justify-center
          md:hidden
        "
      >
        <div
          className="
            relative
            grid
            h-16
            w-16
            place-items-center
            overflow-hidden
            rounded-[20px]
            border
            border-primary/20
            bg-white
            shadow-[0_14px_35px_rgba(27,75,107,0.13)]
          "
        >
          <div
            className="
              absolute
              inset-0
              bg-gradient-to-br
              from-primary/[0.08]
              to-transparent
            "
          />

          <img
            src={LOGO_SRC}
            alt="SSI Logo"
            className="
              relative
              h-10
              w-10
              object-contain
            "
          />
        </div>
      </motion.div>

      {/* Error */}
      <div className="min-h-[54px]">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="login-error"
              initial={{
                opacity: 0,
                scale: 0.97,
                y: -8,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.97,
                y: -6,
              }}
              transition={{
                duration: 0.28,
                ease: PREMIUM_EASE,
              }}
              className="
                mb-4
                rounded-[14px]
                border
                border-red-200
                bg-red-50
                px-4
                py-3
                text-center
                text-[12px]
                font-semibold
                text-red-600
                shadow-[0_8px_24px_rgba(239,68,68,0.08)]
              "
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.form
        variants={formVariants}
        onSubmit={handleLogin}
        className="space-y-5"
      >
        {/* Login ID */}
        <motion.div
          variants={itemVariants}
          className="space-y-2"
        >
          <label
            htmlFor="username"
            className="
              ml-1
              block
              text-[11px]
              font-bold
              uppercase
              tracking-[0.12em]
              text-secondary/65
            "
          >
            Login ID
          </label>

          <input
            id="username"
            type="text"
            name="username"
            autoComplete="username"
            placeholder="Enter login ID"
            value={
              credentials.username
            }
            disabled={
              isInteracting
            }
            onChange={
              handleInputChange
            }
            className="
              h-[56px]
              w-full

              rounded-[18px]

              border
              border-gray-200

              bg-[#F6F8FB]

              px-5

              text-[14px]
              font-medium
              text-secondary

              outline-none

              transition-all
              duration-250

              placeholder:text-gray-400

              shadow-[inset_0_1px_2px_rgba(15,23,42,0.025)]

              hover:border-primary/25
              hover:bg-white

              focus:border-primary/50
              focus:bg-white

              focus:shadow-[0_0_0_4px_rgba(26,158,143,0.08),0_10px_28px_rgba(27,75,107,0.06)]

              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          />
        </motion.div>

        {/* Password */}
        <motion.div
          variants={itemVariants}
          className="space-y-2"
        >
          <label
            htmlFor="password"
            className="
              ml-1
              block
              text-[11px]
              font-bold
              uppercase
              tracking-[0.12em]
              text-secondary/65
            "
          >
            Password
          </label>

          <div className="relative">
            <input
              id="password"
              type={
                showPassword
                  ? 'text'
                  : 'password'
              }
              name="password"
              autoComplete="current-password"
              placeholder="••••••••••"
              value={
                credentials.password
              }
              disabled={
                isInteracting
              }
              onChange={
                handleInputChange
              }
              className="
                h-[56px]
                w-full

                rounded-[18px]

                border
                border-gray-200

                bg-[#F6F8FB]

                px-5
                pr-14

                text-[14px]
                font-medium
                text-secondary

                outline-none

                transition-all
                duration-250

                placeholder:text-gray-400

                shadow-[inset_0_1px_2px_rgba(15,23,42,0.025)]

                hover:border-primary/25
                hover:bg-white

                focus:border-primary/50
                focus:bg-white

                focus:shadow-[0_0_0_4px_rgba(26,158,143,0.08),0_10px_28px_rgba(27,75,107,0.06)]

                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            />

            <motion.button
              type="button"
              disabled={
                isInteracting
              }
              whileHover={{
                scale: 1.06,
              }}
              whileTap={{
                scale: 0.94,
              }}
              onClick={() =>
                setShowPassword(
                  (current) =>
                    !current,
                )
              }
              aria-label={
                showPassword
                  ? 'Hide password'
                  : 'Show password'
              }
              className="
                absolute
                right-3
                top-1/2

                grid
                h-9
                w-9

                -translate-y-1/2

                cursor-pointer
                place-items-center

                rounded-xl

                text-gray-400

                transition-colors

                hover:bg-primary/[0.06]
                hover:text-primary

                disabled:cursor-not-allowed
              "
            >
              <AnimatePresence
                mode="wait"
                initial={false}
              >
                {showPassword ? (
                  <motion.span
                    key="show"
                    initial={{
                      opacity: 0,
                      scale: 0.75,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.75,
                    }}
                  >
                    <Eye
                      size={18}
                      strokeWidth={1.9}
                    />
                  </motion.span>
                ) : (
                  <motion.span
                    key="hide"
                    initial={{
                      opacity: 0,
                      scale: 0.75,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.75,
                    }}
                  >
                    <EyeOff
                      size={18}
                      strokeWidth={1.9}
                    />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </motion.div>

        {/* Login button */}
        <motion.div
          variants={itemVariants}
          className="pt-4"
        >
          <motion.button
            type="submit"
            disabled={
              isInteracting
            }
            whileHover={
              loginState === 'idle'
                ? {
                    y: -2,
                    scale: 1.01,
                  }
                : undefined
            }
            whileTap={
              loginState === 'idle'
                ? {
                    y: 0,
                    scale: 0.985,
                  }
                : undefined
            }
            transition={{
              type: 'spring',
              stiffness: 420,
              damping: 28,
            }}
            className={`
              relative
              flex
              h-[56px]
              w-full

              cursor-pointer
              items-center
              justify-center

              overflow-hidden

              rounded-[18px]

              px-5

              text-[14px]
              font-bold
              text-white

              transition-all
              duration-300

              disabled:cursor-not-allowed

              ${
                loginState === 'success'
                  ? `
                    bg-[#16A36A]
                    shadow-[0_12px_30px_rgba(22,163,106,0.28)]
                  `
                  : `
                    bg-[linear-gradient(135deg,#168F82_0%,#146E8A_100%)]
                    shadow-[0_14px_32px_rgba(20,110,138,0.28)]
                    hover:shadow-[0_18px_38px_rgba(20,110,138,0.34)]
                  `
              }
            `}
          >
            <span
              className="
                pointer-events-none
                absolute
                inset-[1px]
                rounded-[17px]
                border
                border-white/15
              "
            />

            {loginState === 'idle' && (
              <motion.span
                initial={{
                  x: '-180%',
                }}
                animate={{
                  x: '230%',
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  repeatDelay: 3,
                  ease: 'easeInOut',
                }}
                className="
                  pointer-events-none
                  absolute
                  inset-y-0
                  w-[30%]
                  -skew-x-12
                  bg-gradient-to-r
                  from-transparent
                  via-white/20
                  to-transparent
                "
              />
            )}

            <AnimatePresence
              mode="wait"
              initial={false}
            >
              {loginState ===
              'loading' ? (
                <motion.div
                  key="loading"
                  initial={{
                    opacity: 0,
                    scale: 0.9,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.9,
                  }}
                  className="
                    relative
                    z-10
                    flex
                    items-center
                    gap-2.5
                  "
                >
                  <motion.span
                    animate={{
                      rotate: 360,
                    }}
                    transition={{
                      duration: 0.75,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                  >
                    <LoaderCircle
                      size={19}
                      strokeWidth={2.4}
                    />
                  </motion.span>

                  <span>
                    Signing in...
                  </span>
                </motion.div>
              ) : loginState ===
                'success' ? (
                <motion.div
                  key="success"
                  initial={{
                    opacity: 0,
                    scale: 0.9,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}
                  className="
                    relative
                    z-10
                    flex
                    items-center
                    gap-2.5
                  "
                >
                  <motion.svg
                    initial={{
                      scale: 0.4,
                      rotate: -20,
                    }}
                    animate={{
                      scale: 1,
                      rotate: 0,
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 23,
                    }}
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.8}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m5 12 4 4L19 6"
                    />
                  </motion.svg>

                  <span>
                    Login successful
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{
                    opacity: 0,
                    y: 3,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  className="
                    relative
                    z-10
                    flex
                    items-center
                    gap-2.5
                  "
                >
                  <span>
                    Login
                  </span>

                  <ArrowRight
                    size={19}
                    strokeWidth={2.3}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </motion.div>

        {/* Status spacing */}
        <AnimatePresence>
          {loginState ===
            'loading' && (
            <motion.p
              initial={{
                opacity: 0,
                y: 5,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
              }}
              className="
                text-center
                text-[11px]
                font-medium
                tracking-wide
                text-secondary/55
              "
            >
              Verifying credentials
            </motion.p>
          )}
        </AnimatePresence>
      </motion.form>
    </motion.div>
  );
}