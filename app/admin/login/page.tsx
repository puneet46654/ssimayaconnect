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
} from 'lucide-react';

import {
  FormEvent,
  useState,
} from 'react';

import { useRouter } from 'next/navigation';

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

const LOGO_SRC = '/logos/ssilogo.png';

const PREMIUM_EASE: [
  number,
  number,
  number,
  number,
] = [0.16, 1, 0.3, 1];

const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 18,
  },

  visible: {
    opacity: 1,
    y: 0,

    transition: {
      duration: 0.55,
      ease: PREMIUM_EASE,
    },
  },
};

const formVariants: Variants = {
  hidden: {},

  visible: {
    transition: {
      staggerChildren: 0.075,
      delayChildren: 0.2,
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

  const iosSpring = {
    type: 'spring' as const,
    stiffness: 480,
    damping: 28,
    mass: 0.8,
  };

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
          900,
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
      'ssi_admin_token',
      token,
    );

    setLoginState('success');

    window.setTimeout(() => {
      router.push(
        '/admin/landing',
      );

      router.refresh();
    }, 850);
  }

  return (
    <motion.div
      variants={formVariants}
      initial="hidden"
      animate="visible"
      className="
        mx-auto
        w-full
        max-w-[370px]
      "
    >
      {/* Mobile Brand */}
      <motion.div
        variants={itemVariants}
        className="
          mb-10
          flex
          flex-col
          items-center
          justify-center
          text-center
          md:hidden
        "
      >
        <div
          className="
            relative
            mb-4
            grid
            h-16
            w-16
            place-items-center
            overflow-hidden
            rounded-[21px]
            border
            border-primary/[0.16]
            bg-white/[0.92]
            shadow-[0_14px_40px_rgba(27,75,107,0.14)]
            backdrop-blur-xl
          "
        >
          <div
            className="
              absolute inset-0
              bg-gradient-to-br
              from-primary/[0.06]
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

        <p
          className="
            text-[11px]
            font-bold
            uppercase
            tracking-[0.16em]
            text-secondary
          "
        >
          SSI Maya Connect
        </p>
      </motion.div>

      {/* Error */}
      <div className="min-h-[54px]">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="login-error"
              initial={{
                opacity: 0,
                scale: 0.96,
                y: -8,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.96,
                y: -8,
              }}
              transition={{
                duration: 0.32,
                ease: PREMIUM_EASE,
              }}
              className="
                mb-4
                rounded-[16px]
                border
                border-red-200/[0.85]
                bg-red-50/[0.78]
                px-4
                py-3
                text-center
                text-[12px]
                font-semibold
                text-red-600
                shadow-[0_10px_28px_rgba(239,68,68,0.08)]
                backdrop-blur-xl
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
        className="space-y-6"
      >
        {/* Login ID */}
        <motion.div
          variants={itemVariants}
          className="space-y-2.5"
        >
          <label
            htmlFor="username"
            className="
              ml-3
              block
              text-[11px]
              font-bold
              uppercase
              tracking-[0.13em]
              text-gray-500
            "
          >
            Login ID
          </label>

          <div
            className="
              group
              relative
            "
          >
            <div
              className="
                pointer-events-none
                absolute
                inset-0
                rounded-[22px]
                bg-gradient-to-br
                from-white/[0.95]
                via-white/[0.62]
                to-primary/[0.035]
                opacity-0
                transition-opacity
                duration-300
                group-focus-within:opacity-100
              "
            />

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
                relative
                h-[58px]
                w-full
                rounded-[22px]
                border
                border-white/[0.76]
                bg-[#F3F6FA]/[0.88]
                px-6
                text-[14px]
                font-medium
                text-secondary
                outline-none
                backdrop-blur-xl
                transition-all
                duration-300

                placeholder:font-normal
                placeholder:text-gray-400

                shadow-[inset_4px_4px_10px_rgba(15,23,42,0.035),inset_-4px_-4px_12px_rgba(255,255,255,0.95),0_4px_14px_rgba(15,23,42,0.015)]

                hover:border-primary/[0.12]
                hover:bg-[#F7F9FC]

                focus:border-primary/[0.38]
                focus:bg-white/[0.96]
                focus:shadow-[0_14px_36px_rgba(26,158,143,0.10),0_0_0_4px_rgba(26,158,143,0.055)]

                disabled:cursor-not-allowed
                disabled:opacity-65
              "
            />
          </div>
        </motion.div>

        {/* Password */}
        <motion.div
          variants={itemVariants}
          className="space-y-2.5"
        >
          <label
            htmlFor="password"
            className="
              ml-3
              block
              text-[11px]
              font-bold
              uppercase
              tracking-[0.13em]
              text-gray-500
            "
          >
            Password
          </label>

          <div
            className="
              group
              relative
            "
          >
            <div
              className="
                pointer-events-none
                absolute
                inset-0
                rounded-[22px]
                bg-gradient-to-br
                from-white/[0.95]
                via-white/[0.62]
                to-primary/[0.035]
                opacity-0
                transition-opacity
                duration-300
                group-focus-within:opacity-100
              "
            />

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
                relative
                h-[58px]
                w-full
                rounded-[22px]
                border
                border-white/[0.76]
                bg-[#F3F6FA]/[0.88]
                px-6
                pr-16
                text-[14px]
                font-medium
                text-secondary
                outline-none
                backdrop-blur-xl
                transition-all
                duration-300

                placeholder:text-gray-400

                shadow-[inset_4px_4px_10px_rgba(15,23,42,0.035),inset_-4px_-4px_12px_rgba(255,255,255,0.95),0_4px_14px_rgba(15,23,42,0.015)]

                hover:border-primary/[0.12]
                hover:bg-[#F7F9FC]

                focus:border-primary/[0.38]
                focus:bg-white/[0.96]
                focus:shadow-[0_14px_36px_rgba(26,158,143,0.10),0_0_0_4px_rgba(26,158,143,0.055)]

                disabled:cursor-not-allowed
                disabled:opacity-65
              "
            />

            <motion.button
              type="button"
              disabled={
                isInteracting
              }
              whileHover={
                !isInteracting
                  ? {
                      scale: 1.08,
                    }
                  : undefined
              }
              whileTap={
                !isInteracting
                  ? {
                      scale: 0.92,
                    }
                  : undefined
              }
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
                right-4
                top-1/2
                z-10
                grid
                h-9
                w-9
                -translate-y-1/2
                cursor-pointer
                place-items-center
                rounded-xl
                text-gray-400
                transition-colors
                hover:bg-white/[0.75]
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
                    key="eye-open"
                    initial={{
                      opacity: 0,
                      scale: 0.7,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.7,
                    }}
                  >
                    <Eye
                      size={19}
                      strokeWidth={1.8}
                    />
                  </motion.span>
                ) : (
                  <motion.span
                    key="eye-closed"
                    initial={{
                      opacity: 0,
                      scale: 0.7,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.7,
                    }}
                  >
                    <EyeOff
                      size={19}
                      strokeWidth={1.8}
                    />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </motion.div>

        {/* Login Action */}
        <motion.div
          variants={itemVariants}
          className="
            flex
            items-center
            justify-between
            pt-7
            pl-3
          "
        >
          <p
            className="
              text-[13px]
              font-semibold
              text-gray-500
            "
          >
            SSI Maya Connect
          </p>

          <motion.button
            type="submit"
            disabled={
              isInteracting
            }
            whileHover={
              !isInteracting
                ? {
                    scale: 1.09,
                    y: -3,
                  }
                : undefined
            }
            whileTap={
              !isInteracting
                ? {
                    scale: 0.91,
                    y: 1,
                  }
                : undefined
            }
            transition={iosSpring}
            aria-label="Login"
            className={`
              group
              relative
              grid
              h-[66px]
              w-[66px]
              shrink-0
              cursor-pointer
              place-items-center
              overflow-hidden
              rounded-full
              text-white
              transition-colors
              duration-300
              disabled:cursor-not-allowed

              ${
                loginState === 'success'
                  ? `
                    bg-success
                    shadow-[0_18px_42px_rgba(16,185,129,0.34),inset_0_2px_2px_rgba(255,255,255,0.30)]
                  `
                  : `
                    bg-gradient-to-br
                    from-primary
                    via-primary
                    to-secondary-mid
                    shadow-[0_18px_42px_rgba(26,158,143,0.38),inset_0_2px_2px_rgba(255,255,255,0.34)]
                  `
              }
            `}
          >
            <span
              className="
                pointer-events-none
                absolute
                inset-[1px]
                rounded-full
                border
                border-white/[0.15]
              "
            />

            {loginState === 'idle' && (
              <motion.span
                initial={{
                  x: '-180%',
                }}
                animate={{
                  x: '220%',
                }}
                transition={{
                  duration: 2.6,
                  repeat: Infinity,
                  repeatDelay: 2.8,
                  ease: 'easeInOut',
                }}
                className="
                  pointer-events-none
                  absolute
                  inset-y-0
                  w-[35%]
                  -skew-x-12
                  bg-gradient-to-r
                  from-transparent
                  via-white/[0.28]
                  to-transparent
                "
              />
            )}

            <AnimatePresence
              mode="wait"
              initial={false}
            >
              {loginState === 'loading' ? (
                <motion.span
                  key="loading"
                  initial={{
                    opacity: 0,
                    scale: 0.7,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.7,
                  }}
                  className="
                    relative
                    h-7
                    w-7
                  "
                >
                  <span
                    className="
                      absolute
                      inset-0
                      rounded-full
                      border-[2.5px]
                      border-white/[0.24]
                    "
                  />

                  <motion.span
                    animate={{
                      rotate: 360,
                    }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                    className="
                      absolute
                      inset-0
                      rounded-full
                      border-[2.5px]
                      border-transparent
                      border-r-white
                      border-t-white
                    "
                  />
                </motion.span>
              ) : loginState ===
                'success' ? (
                <motion.svg
                  key="success"
                  initial={{
                    opacity: 0,
                    scale: 0.25,
                    rotate: -25,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    rotate: 0,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 520,
                    damping: 23,
                  }}
                  className="
                    relative z-10
                    h-7 w-7
                  "
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
              ) : (
                <motion.span
                  key="arrow"
                  initial={{
                    opacity: 0,
                    x: -5,
                  }}
                  animate={{
                    opacity: 1,
                    x: 0,
                  }}
                  exit={{
                    opacity: 0,
                    x: 6,
                  }}
                  className="
                    relative z-10
                  "
                >
                  <ArrowRight
                    size={27}
                    strokeWidth={2.4}
                    className="
                      transition-transform
                      duration-300
                      group-hover:translate-x-1
                    "
                  />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </motion.div>

        {/* Status */}
        <div className="h-7">
          <AnimatePresence mode="wait">
            {loginState === 'loading' && (
              <motion.p
                key="signing"
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
                className="
                  text-center
                  text-[11px]
                  font-semibold
                  tracking-wide
                  text-primary
                "
              >
                Signing in...
              </motion.p>
            )}

            {loginState === 'success' && (
              <motion.p
                key="success-text"
                initial={{
                  opacity: 0,
                  y: 6,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                className="
                  text-center
                  text-[11px]
                  font-semibold
                  tracking-wide
                  text-success
                "
              >
                Login successful
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.form>
    </motion.div>
  );
}