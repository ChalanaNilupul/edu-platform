export const instant = false;

import { RegisterForm } from '@/components/register-form';
import { safeInternalPath } from '@/lib/safe-redirect';

type RegisterPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const nextPath = safeInternalPath(typeof params.next === 'string' ? params.next : null);

  return <RegisterForm nextPath={nextPath} />;
}
