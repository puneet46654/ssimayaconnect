'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppFeedbackDialog } from '@/components/user/AppFeedback';

/*
 * One header, footer and (on phones) bottom nav for every user-side page,
 * so the frame never changes while moving through the booking flow.
 * Pages render only their own content below the header.
 */

const ROOT_PAGES = ['/events', '/events/mytickets'];
const YEAR = new Date().getFullYear();

const BUTTON = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-[11px] font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/15';
const BUTTON_IDLE = 'border-gray-200 bg-white text-secondary hover:border-primary/25 hover:bg-primary/[0.035] hover:text-primary';
const BUTTON_ACTIVE = 'border-primary/30 bg-primary/[0.06] text-primary';
const ROUND = 'grid shrink-0 place-items-center rounded-full text-secondary transition active:scale-95';

function useChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const onTickets = pathname.startsWith('/events/mytickets');
  return {
    onTickets,
    onEvents: !onTickets,
    showBack: !ROOT_PAGES.includes(pathname),
    isEventDetails: /^\/events\/[^/]+$/.test(pathname) && !ROOT_PAGES.includes(pathname),
    goBack() {
      if (window.history.length > 1) router.back();
      else router.push('/events');
    },
  };
}

function useShare() {
  const [shared, setShared] = useState(false);
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShared(true);
      window.setTimeout(() => setShared(false), 1800);
    } catch {
      // User cancelled the share sheet.
    }
  }
  return { shared, share };
}

export function UserHeader() {
  const chrome = useChrome();
  const { shared, share } = useShare();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const shareLabel = shared ? 'Link copied' : 'Share this event';

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-[#F7F9FA]/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:bg-white/95 md:pt-0">
        {/* Phones */}
        <div className="mx-auto flex h-[52px] max-w-[520px] items-center gap-2.5 px-4 md:hidden">
          {chrome.showBack && (
            <button type="button" onClick={chrome.goBack} aria-label="Go back" className={`-ml-1.5 h-9 w-9 active:bg-gray-200/70 ${ROUND}`}>
              <BackIcon />
            </button>
          )}
          <Brand compact />
          <div className="ml-auto flex items-center gap-1">
            {chrome.isEventDetails && (
              <button type="button" onClick={() => void share()} aria-label={shareLabel} className={`h-9 w-9 active:bg-gray-200/70 ${ROUND}`}>
                <ShareIcon done={shared} />
              </button>
            )}
            <button type="button" onClick={() => setFeedbackOpen(true)} aria-label="Feedback" className={`-mr-1.5 h-9 w-9 active:bg-gray-200/70 ${ROUND}`}>
              <FeedbackIcon />
            </button>
          </div>
        </div>

        {/* Tablets and desktops */}
        <div className="mx-auto hidden h-[66px] w-full max-w-[1500px] items-center justify-between gap-6 px-6 md:flex lg:px-10">
          <div className="flex items-center gap-3">
            {chrome.showBack && (
              <button type="button" onClick={chrome.goBack} aria-label="Go back"
                className={`group h-10 w-10 border border-gray-200 bg-white shadow-[0_2px_8px_rgba(27,75,107,0.05)] hover:border-primary/30 hover:text-primary ${ROUND}`}>
                <BackIcon />
              </button>
            )}
            <Brand />
          </div>
          <nav aria-label="Main" className="flex items-center gap-2">
            {chrome.isEventDetails && (
              <button type="button" onClick={() => void share()} className={`${BUTTON} ${BUTTON_IDLE}`}>
                <ShareIcon done={shared} />
                {shared ? 'Link copied' : 'Share'}
              </button>
            )}
            <Link href="/events" aria-current={chrome.onEvents ? 'page' : undefined} className={`${BUTTON} ${chrome.onEvents ? BUTTON_ACTIVE : BUTTON_IDLE}`}>
              <EventsIcon />
              Events
            </Link>
            <Link href="/events/mytickets" aria-current={chrome.onTickets ? 'page' : undefined} className={`${BUTTON} ${chrome.onTickets ? BUTTON_ACTIVE : BUTTON_IDLE}`}>
              <TicketIcon />
              My Tickets
            </Link>
            <button type="button" onClick={() => setFeedbackOpen(true)} className={`${BUTTON} ${BUTTON_IDLE}`}>
              <FeedbackIcon />
              Feedback
            </button>
          </nav>
        </div>
      </header>
      {feedbackOpen && <AppFeedbackDialog onClose={() => setFeedbackOpen(false)} />}
    </>
  );
}

export function UserFooter() {
  return (
    <footer className="border-t border-gray-200/80 bg-white">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col items-center gap-3 px-4 py-5 text-[11px] text-gray-500 md:flex-row md:justify-between md:px-6 lg:px-10">
        <div className="flex items-center gap-2">
          <Image src="/logos/ssilogo.png" alt="" width={18} height={18} className="shrink-0 object-contain" />
          <span>© {YEAR} SS Innovations International, Inc. · SSI Maya Connect</span>
        </div>
        <nav aria-label="Footer" className="flex items-center gap-4 font-semibold text-secondary">
          <Link href="/events" className="hover:text-primary">Events</Link>
          <Link href="/events/mytickets" className="hover:text-primary">My Tickets</Link>
        </nav>
      </div>
    </footer>
  );
}

export function UserBottomNav() {
  const { onTickets } = useChrome();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[var(--user-nav-h)] grid-cols-2 border-t border-gray-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgba(27,75,107,0.045)] backdrop-blur-xl md:hidden">
      <NavItem href="/events" label="Events" active={!onTickets}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5M5 9.5V20h5v-6h4v6h5V9.5" />
      </NavItem>
      <NavItem href="/events/mytickets" label="My Tickets" active={onTickets}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V7Zm10-2v12" />
      </NavItem>
    </nav>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/events" className="inline-flex min-w-0 items-center gap-2 transition-opacity hover:opacity-80">
      <Image src="/logos/ssilogo.png" alt="SSI" width={compact ? 24 : 26} height={compact ? 24 : 26} priority className="shrink-0 object-contain" />
      <span className={`truncate font-semibold text-secondary ${compact ? 'text-[13px]' : 'text-[14px]'}`}>SSI Maya Connect</span>
    </Link>
  );
}

function NavItem({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
        active ? 'text-primary' : 'text-gray-400'
      }`}
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        {children}
      </svg>
      {label}
    </Link>
  );
}

function BackIcon() {
  return (
    <svg className="h-[18px] w-[18px] transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ShareIcon({ done }: { done: boolean }) {
  return done ? (
    <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  ) : (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0-12 4 4m-4-4L8 7M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}

function EventsIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 011 1v14H4V6a1 1 0 011-1Z" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5h14v4a3 3 0 010 6v4H5v-4a3 3 0 010-6V5Z" />
      <path strokeLinecap="round" d="M12 7v10" />
    </svg>
  );
}

function FeedbackIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      <path strokeLinecap="round" d="M8 9h8M8 13h5" />
    </svg>
  );
}
