import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Library,
  Search,
  Users,
  Wallet,
} from 'lucide-react';
import { LogoutButton } from './logout-button';
import { EmailVerificationBanner } from './email-verification-banner';

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { label: 'Workspaces', icon: Building2, href: '/workspaces' },
  { label: 'Students', icon: Users },
  { label: 'Teachers', icon: GraduationCap },
  { label: 'Classes', icon: BookOpen },
  { label: 'Attendance', icon: ClipboardCheck },
  { label: 'Finance', icon: Wallet },
  { label: 'Learning', icon: Library },
  { label: 'Examinations', icon: CalendarDays },
  { label: 'Reports', icon: BarChart3 },
];

const stats = [
  {
    label: 'Total students',
    value: '1,248',
    change: '+12.5%',
    icon: Users,
    color: 'bg-blue-50 text-blue-600',
  },
  {
    label: 'Attendance today',
    value: '92.4%',
    change: '+4.2%',
    icon: ClipboardCheck,
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    label: 'Fees collected',
    value: 'LKR 485,000',
    change: '+8.3%',
    icon: Wallet,
    color: 'bg-violet-50 text-violet-600',
  },
  {
    label: 'Active classes',
    value: '36',
    change: 'Across all batches',
    icon: BookOpen,
    color: 'bg-amber-50 text-amber-600',
  },
];

type DashboardUser = {
  firstName: string;
  lastName: string | null;
  email: string;
  emailVerifiedAt: string | null;
};

type DashboardShellProps = {
  user: DashboardUser;
  activePage?: 'Dashboard' | 'Workspaces' | 'Students' | 'Teachers' | 'Classes';
  studentsHref?: string;
  teachersHref?: string;
  classesHref?: string;
  children?: ReactNode;
};

export function DashboardShell({
  user,
  activePage = 'Dashboard',
  studentsHref,
  teachersHref,
  classesHref,
  children,
}: DashboardShellProps) {
  const resolvedTeachersHref =
    teachersHref ??
    (studentsHref?.endsWith('/students')
      ? `${studentsHref.slice(0, -'/students'.length)}/teachers`
      : undefined);

  const resolvedClassesHref =
    classesHref ??
    (studentsHref?.endsWith('/students')
      ? `${studentsHref.slice(0, -'/students'.length)}/classes`
      : undefined);

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
  const initials = fullName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col bg-[#172B4D] text-white lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
            <GraduationCap size={23} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">EduPlatform</h1>
            <p className="text-xs text-blue-200">Education management</p>
          </div>
        </div>

        <div className="px-4 py-6">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-blue-200/70">
            Workspace
          </p>
          <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-3">
            <p className="text-sm font-semibold">Workspace management</p>
            <p className="mt-1 text-xs text-blue-200">Manage your education spaces</p>
          </div>
        </div>

        <nav className="flex-1 px-4">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-blue-200/70">
            Main menu
          </p>

          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = item.label === activePage;
              const href =
                item.label === 'Students'
                  ? studentsHref
                  : item.label === 'Teachers'
                    ? resolvedTeachersHref
                    : item.label === 'Classes'
                      ? resolvedClassesHref
                      : item.href;

              const className = `flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 font-semibold text-white'
                  : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
              }`;

              if (href) {
                return (
                  <Link
                    key={item.label}
                    href={href}
                    aria-current={isActive ? 'page' : undefined}
                    className={className}
                  >
                    <Icon size={19} />
                    <span>{item.label}</span>
                  </Link>
                );
              }

              return (
                <div
                  key={item.label}
                  className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-3 text-sm text-blue-100/40"
                  title="Coming soon"
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-white/10 p-5">
          <p className="text-sm font-medium">EduPlatform</p>
          <p className="mt-1 text-xs text-blue-200/70">Version 0.1.0</p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
          <div>
            <p className="text-sm text-slate-500">Workspace / {activePage}</p>
            <h2 className="text-lg font-semibold text-slate-900">{activePage}</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-500 sm:flex">
              <Search size={17} />
              <span>Search</span>
              <span className="ml-8 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs">
                /
              </span>
            </div>

            <div className="relative rounded-lg p-2 text-slate-500">
              <Bell size={20} />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-blue-600" />
            </div>

            <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                {initials}
              </div>

              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-slate-800">{fullName}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>

              <LogoutButton />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl p-5 sm:p-8">
          {user.emailVerifiedAt ? null : <EmailVerificationBanner />}

          {children ?? (
            <>
              <div className="mb-8">
                <p className="text-sm font-medium text-blue-600">
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Welcome, {user.firstName}!
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Here&apos;s what&apos;s happening in your workspace today.
                </p>
              </div>

              <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => {
                  const Icon = stat.icon;

                  return (
                    <div
                      key={stat.label}
                      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}
                        >
                          <Icon size={20} />
                        </div>
                      </div>

                      <p className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
                        {stat.value}
                      </p>
                      <p className="mt-2 text-xs font-medium text-emerald-600">{stat.change}</p>
                    </div>
                  );
                })}
              </section>

              <section className="mt-8 grid gap-5 xl:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">Workspace overview</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Your education operations at a glance.
                      </p>
                    </div>
                    <Activity className="text-blue-600" size={21} />
                  </div>

                  <div className="mt-8 flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                    <BarChart3 size={34} className="text-slate-400" />
                    <p className="mt-3 text-sm font-medium text-slate-700">
                      Analytics will appear here
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Attendance, enrollment and financial trends.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="font-semibold text-slate-900">Upcoming classes</h3>
                  <p className="mt-1 text-sm text-slate-500">Your next scheduled sessions.</p>

                  <div className="mt-6 space-y-5">
                    {[
                      {
                        subject: 'Mathematics',
                        time: '09:00 AM',
                        batch: 'Grade 10',
                      },
                      {
                        subject: 'Science',
                        time: '11:30 AM',
                        batch: 'Grade 11',
                      },
                      {
                        subject: 'English',
                        time: '02:00 PM',
                        batch: 'Grade 9',
                      },
                    ].map((session) => (
                      <div key={session.subject} className="flex gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                          <CalendarDays size={19} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{session.subject}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {session.batch} · {session.time}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
