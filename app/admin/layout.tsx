'use client';

import Sidebar from '@/app/components/admin/Sidebar';
import { usePathname } from 'next/navigation';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (
    pathname === '/admin' ||
    pathname === '/admin/login'
  ) {
    return children;
  }

  return (
    <div className="flex min-h-screen w-full bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-[232px] lg:w-[248px] xl:w-[256px] shrink-0">
        <Sidebar />
      </aside>

      {/* Main Content */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div
          className="
            w-full
            max-w-[1600px]
            mx-auto

            px-5
            py-5

            sm:px-7
            sm:py-6

            md:px-8
            md:py-7

            lg:px-10
            lg:py-8

            xl:px-12
            xl:py-9

            2xl:px-14
            2xl:py-10
          "
        >
          {children}
        </div>
      </main>
    </div>
  );
}