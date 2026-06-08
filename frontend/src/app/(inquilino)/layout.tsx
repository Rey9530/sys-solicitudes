import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AppShell } from '@/components/shell/app-shell';

/** Layout del portal del inquilino (T-060). Solo rol `inquilino`. */
export default async function InquilinoLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.rol !== 'inquilino') redirect('/');

  return (
    <AppShell
      role="inquilino"
      user={{ name: session.user.name ?? null, email: session.user.email ?? null }}
      plaza={null}
    >
      {children}
    </AppShell>
  );
}
