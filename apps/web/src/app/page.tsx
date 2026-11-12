export const instant = false;

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard-shell';

export default async function HomePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('edu_session')?.value;

  if (!sessionToken) {
    redirect('/login');
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

  const response = await fetch(`${apiUrl}/auth/me`, {
    headers: {
      Cookie: `edu_session=${sessionToken}`,
    },
    cache: 'no-store',
  });

  if (response.status === 401) {
    redirect('/login');
  }

  if (!response.ok) {
    throw new Error('Unable to verify your EduPlatform session.');
  }

  const data = await response.json();

  return <DashboardShell user={data.user} />;
}
