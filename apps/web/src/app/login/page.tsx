export const instant = false;

import { LoginForm } from '@/components/login-form';

const notices: Record<string, string> = {
  registered: 'Account created. Check your email to verify your address, then sign in.',
  verified: 'Your email address is verified. You can sign in now.',
  reset: 'Your password was reset. Sign in with your new password.',
};

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const noticeKey = ['registered', 'verified', 'reset'].find((key) => params[key]);
  const notice = noticeKey ? (notices[noticeKey] ?? '') : '';
  const requestedNext = typeof params.next === 'string' ? params.next : '';

  // Browsers treat `\` like `/`, so `/\host` would also leave the origin.
  const nextPath =
    requestedNext.startsWith('/') &&
    !requestedNext.startsWith('//') &&
    !requestedNext.includes('\\')
      ? requestedNext
      : '/';

  return <LoginForm notice={notice} nextPath={nextPath} />;
}
