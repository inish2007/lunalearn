'use client';

import { useEffect, useState } from 'react';

export default function CountUp({
  from = 0,
  to,
  separator = '',
  direction = 'up',
  duration = 1,
  className = '',
  suffix = '',
}: {
  from?: number;
  to: number;
  separator?: string;
  direction?: 'up' | 'down';
  duration?: number;
  className?: string;
  suffix?: string;
}) {
  const start = direction === 'down' ? to : from;
  const end = direction === 'down' ? from : to;
  const [value, setValue] = useState(start);

  useEffect(() => {
    setValue(start);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(end);
      return;
    }

    let frame = 0;
    const started = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - started) / (duration * 1000), 1);
      setValue(Math.round(start + (end - start) * (1 - Math.pow(1 - progress, 3))));

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [start, end, duration]);

  return (
    <span data-count-up className={`tabular-nums ${className}`}>
      {separator
        ? value.toLocaleString('en-US').replace(/,/g, separator)
        : value}
      {suffix}
    </span>
  );
}
