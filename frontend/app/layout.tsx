import type { Metadata } from 'next';
import { AcademicProvider } from '@/lib/context/AcademicContext';
import { ThemeProvider } from '@/lib/context/ThemeContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'LunaLearn — Your next best study step',
  description: 'Learning & Unified Academic Navigator'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('lunalearn_theme');var d=t==='dark'||t===null||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})()`
          }}
        />
      </head>
      <body className="min-h-screen bg-canvas text-ink antialiased selection:bg-accent/30 selection:text-ink">
        <ThemeProvider>
          <AcademicProvider>
            {children}
          </AcademicProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
