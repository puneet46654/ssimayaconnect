import { UserBottomNav, UserHeader } from '@/components/user/UserChrome';

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="[--user-nav-h:calc(60px+env(safe-area-inset-bottom))]">
      <UserHeader />
      {children}
      {/* Keeps page content clear of the fixed bottom nav on mobile */}
      <div aria-hidden="true" className="h-[var(--user-nav-h)] md:hidden" />
      <UserBottomNav />
    </div>
  );
}
