import { getAuthContext } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== 'admin') redirect('/');
  return <>{children}</>;
}
