"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/* ------------------------------------------------------------------ *
 *  League badge PNG processing
 *  The source PNGs sit on a black box. We downscale to a small canvas,
 *  chroma-key the dark background to transparent (with feathered edges),
 *  and cache the result so we never re-process on repeat visits.
 * ------------------------------------------------------------------ */

const BADGE_SIZE = 256;
const cleanCache = new Map<string, string>();

function processBadge(src: string): Promise<string> {
  const cached = cleanCache.get(src);
  if (cached) return Promise.resolve(cached);

  try {
    const stored = sessionStorage.getItem(`cc-badge:${src}`);
    if (stored) {
      cleanCache.set(src, stored);
      return Promise.resolve(stored);
    }
  } catch {
    /* ignore */
  }

  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = BADGE_SIZE;
        canvas.height = BADGE_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(src);
        ctx.drawImage(img, 0, 0, BADGE_SIZE, BADGE_SIZE);

        const imageData = ctx.getImageData(0, 0, BADGE_SIZE, BADGE_SIZE);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const brightness = Math.max(data[i], data[i + 1], data[i + 2]);
          if (brightness < 30) {
            data[i + 3] = 0;
          } else if (brightness < 64) {
            data[i + 3] = Math.round(255 * ((brightness - 30) / 34));
          }
        }
        ctx.putImageData(imageData, 0, 0);

        const url = canvas.toDataURL("image/png");
        cleanCache.set(src, url);
        try {
          sessionStorage.setItem(`cc-badge:${src}`, url);
        } catch {
          /* ignore */
        }
        resolve(url);
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

export function TransparentBadge({
  src,
  alt,
  glow,
  className,
}: {
  src: string;
  alt: string;
  glow: string;
  className?: string;
}) {
  const [cleanSrc, setCleanSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    processBadge(src).then((url) => {
      if (!cancelled) setCleanSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <Image
        src={cleanSrc ?? src}
        alt={alt}
        width={BADGE_SIZE}
        height={BADGE_SIZE}
        unoptimized
        className={`w-full h-auto object-contain transition-opacity duration-700 ease-out ${
          cleanSrc ? "opacity-100" : "opacity-0"
        }`}
        style={cleanSrc ? { filter: glow } : undefined}
      />
    </div>
  );
}
