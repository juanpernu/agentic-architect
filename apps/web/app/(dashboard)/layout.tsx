import { ClerkProvider } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { MobileHeader } from '@/components/mobile-header';
import { Toaster } from 'sileo';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <ClerkProvider>
      <div className="min-h-screen">
        <Sidebar />
        <MobileHeader />
        <main className="md:pl-64 pt-[52px] md:pt-0 min-h-screen bg-slate-50/50 dark:bg-background">
          <div className="p-2 md:p-4 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
        <Toaster position="bottom-right" options={{ fill: '#000000' }} />
      </div>
    </ClerkProvider>
  );
}
