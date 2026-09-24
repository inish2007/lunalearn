import type { Metadata } from 'next';
import { CountUpAll } from '@/components/Ui';
import './globals.css';
export const metadata: Metadata = { title: 'LunaLearn — Your next best study step', description: 'Learning & Unified Academic Navigator' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><CountUpAll/>{children}</body></html>; }
