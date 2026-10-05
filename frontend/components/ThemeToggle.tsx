'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/context/ThemeContext';

export function ThemeToggle({ className = '', showLabel = false }: { className?: string; showLabel?: boolean }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dreamy dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dreamy dark mode'}
      className={`group relative inline-flex items-center gap-2 rounded-2xl border border-highlight/40 bg-card p-2 text-ink shadow-sm transition hover:border-primary/50 hover:bg-highlight/20 active:scale-95 ${className}`}
    >
      <div className="relative flex h-6 w-6 items-center justify-center">
        {/* Sun Icon for Light Mode */}
        <Sun
          size={18}
          className={`absolute text-amber-500 transition-all duration-400 ${
            isDark
              ? 'rotate-90 scale-0 opacity-0'
              : 'rotate-0 scale-100 opacity-100'
          }`}
        />
        {/* Glowing Moon Icon for Dark Mode */}
        <Moon
          size={18}
          className={`absolute text-accent transition-all duration-400 drop-shadow-[0_0_8px_rgba(196,181,253,0.6)] ${
            isDark
              ? 'rotate-0 scale-100 opacity-100'
              : '-rotate-90 scale-0 opacity-0'
          }`}
        />
      </div>

      {showLabel && (
        <span className="text-xs font-bold tracking-tight">
          {isDark ? 'Dreamy Mode' : 'Daylight'}
        </span>
      )}
    </button>
  );
}
