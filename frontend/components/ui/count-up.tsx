"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  to: number;
  suffix?: string;
  duration?: number;
}

export function CountUp({ to, suffix = "", duration = 1500 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const startedRef = useRef(false);
  const [value, setValue] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? to
        : 0
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || startedRef.current) return;

    let raf = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        startedRef.current = true;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(Math.round(to * eased));
          if (progress < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}
