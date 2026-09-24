'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

/*
 * One header + bottom nav for every user-side page on mobile,
 * so the frame never changes while moving through the booking flow.
 * Desktop keeps each page's own header.
 */

const ROOT_PAGES = ['/events', '/events/mytickets'];

export function UserHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const showBack = !ROOT_PAGES.includes(pathname);

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push('/events');
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-[#F7F9FA]/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:hidden">
      <div className="mx-auto flex h-[52px] max-w-[520px] items-center gap-2.5">
        {showBack && (
          <button
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="-ml-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-secondary transition active:scale-95 active:bg-gray-200/70"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        <Link href="/events" className="inline-flex items-center gap-2">
          <Image src="/logos/ssilogo.png" alt="SSI" width={24} height={24} priority className="shrink-0 object-contain" />
          <span className="text-[13px] font-semibold text-secondary">SSI Maya Connect</span>
        </Link>
      </div>
    </header>
  );
}

export function UserBottomNav() {
  const pathname = usePathname();
  const onTickets = pathname.startsWith('/events/mytickets');

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
