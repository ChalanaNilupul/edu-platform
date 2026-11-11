import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EduPlatform | Education Management',
  description: 'Manage students, classes, attendance, finance and learning in one platform.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
