"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { Menu, X, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";

const THEME_KEY = "codeclash-theme";

let isDarkClient: boolean | null = null;
const themeListeners = new Set<() => void>();

function getThemeSnapshot(): boolean {
  if (isDarkClient === null) {
    isDarkClient = document.documentElement.classList.contains("dark");
  }
  return isDarkClient;
}

function getThemeServerSnapshot(): boolean {
  return true;
}

function subscribeTheme(listener: () => void): () => void {
  themeListeners.add(listener);
  return () => {
    themeListeners.delete(listener);
  };
}

function setTheme(next: boolean) {
  isDarkClient = next;
  document.documentElement.classList.toggle("dark", next);
  try {
    localStorage.setItem(THEME_KEY, next ? "dark" : "light");
  } catch {
    /* ignore */
  }
  themeListeners.forEach((listener) => listener());
}

interface NavbarProps {
  onOpenAuth: (mode: "login" | "signup") => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : ""))
    .toUpperCase();
}

const NAV_LINKS = [
  { label: "Compete", href: "/compete" },
  { label: "Problems", href: "/problems" },
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Leaderboard", href: "#leaderboard" },
];

function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

export function Navbar({ onOpenAuth }: NavbarProps) {
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [active, setActive] = useState("");
  const isDark = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getThemeServerSnapshot
  );

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setProgress(max > 0 ? (window.scrollY / max) * 100 : 0);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const sections = NAV_LINKS.map((link) => link.href.slice(1));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(`#${entry.target.id}`);
        }
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => setTheme(!isDark);

  return (
    <header className="fixed top-0 inset-x-0 z-40 transition-all duration-500">
      {/* Scroll progress */}
      <div
        aria-hidden
        className="absolute top-0 left-0 h-[2px] nav-progress rounded-r-full"
        style={{ width: `${progress}%` }}
      />

      <div
        className={`transition-all duration-500 ${
          scrolled
            ? "bg-bg/70 backdrop-blur-2xl border-b border-line/70 shadow-soft"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <a href="#" className="flex items-center gap-2.5 group">
            <span className="w-8 h-8 rounded-[9px] bg-accent/12 border border-accent/15 text-accent font-mono font-bold text-[12px] flex items-center justify-center transition-colors group-hover:bg-accent/18">
              {"</>"}
            </span>
            <span className="text-[16px] font-semibold tracking-tight text-ink">
              CodeClash
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) =>
              link.href.startsWith("/") ? (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-link text-sm font-medium transition-colors ${
                    active === link.href
                      ? "nav-link-active text-ink"
                      : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  className={`nav-link text-sm font-medium transition-colors ${
                    active === link.href
                      ? "nav-link-active text-ink"
                      : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {link.label}
                </a>
              )
            )}
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-2.5">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="w-9 h-9 rounded-full flex items-center justify-center text-ink-2 hover:text-ink hover:bg-elevated/70 transition-colors"
            >
              <span key={isDark ? "sun" : "moon"} className="icon-pop">
                {isDark ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
              </span>
            </button>

            {user ? (
              <div className="flex items-center gap-2.5">
                <Link
                  href="/profile"
                  className="flex items-center gap-2.5"
                  aria-label="View your profile"
                >
                  {user.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatar}
                      alt={user.displayName || user.username}
                      className="w-8 h-8 rounded-full ring-2 ring-accent/20 object-cover"
                    />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-accent/12 border border-accent/15 text-accent text-[11px] font-semibold flex items-center justify-center">
                      {getInitials(user.displayName || user.username)}
                    </span>
                  )}
                  <span className="text-sm font-medium text-ink-2">
                    {user.displayName || user.username}
                  </span>
                </Link>
                <button
                  onClick={() => logout()}
                  aria-label="Log out"
                  title="Log out"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-ink-2 hover:text-ink hover:bg-elevated/70 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => onOpenAuth("login")}
                  className="px-3 text-sm font-medium text-ink-2 hover:text-ink transition-colors"
                >
                  Log in
                </button>

                <button
                  onClick={() => onOpenAuth("signup")}
                  className="btn-shine h-9 px-4 rounded-full bg-accent text-accent-ink text-sm font-semibold shadow-soft inline-flex items-center hover:bg-accent-strong transition-colors"
                >
                  Get started
                </button>
              </>
            )}
          </div>

          {/* Mobile controls */}
          <div className="flex md:hidden items-center gap-1.5">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="w-9 h-9 rounded-full flex items-center justify-center text-ink-2"
            >
              <span key={isDark ? "sun" : "moon"} className="icon-pop">
                {isDark ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
              </span>
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              className="w-9 h-9 rounded-full flex items-center justify-center text-ink-2"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden px-5 pb-6 pt-2 bg-bg/90 backdrop-blur-2xl border-b border-line">
          <nav className="flex flex-col">
            {NAV_LINKS.map((link, i) =>
              link.href.startsWith("/") ? (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`mobile-item py-3.5 text-sm font-medium transition-colors border-b border-line/70 ${
                    active === link.href ? "text-ink" : "text-ink-2 hover:text-ink"
                  }`}
                  style={{ animationDelay: `${i * 45}ms` }}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`mobile-item py-3.5 text-sm font-medium transition-colors border-b border-line/70 ${
                    active === link.href ? "text-ink" : "text-ink-2 hover:text-ink"
                  }`}
                  style={{ animationDelay: `${i * 45}ms` }}
                >
                  {link.label}
                </a>
              )
            )}
          </nav>
          <div
            className="mobile-item flex gap-3 pt-5"
            style={{ animationDelay: `${NAV_LINKS.length * 45}ms` }}
          >
            {user ? (
              <>
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 flex items-center gap-3"
                >
                  {user.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatar}
                      alt={user.displayName || user.username}
                      className="w-9 h-9 rounded-full ring-2 ring-accent/20 object-cover"
                    />
                  ) : (
                    <span className="w-9 h-9 rounded-full bg-accent/12 border border-accent/15 text-accent text-[11px] font-semibold flex items-center justify-center">
                      {getInitials(user.displayName || user.username)}
                    </span>
                  )}
                  <span className="text-sm font-medium text-ink">
                    {user.displayName || user.username}
                  </span>
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="h-11 px-5 rounded-full border border-line-strong text-sm font-medium text-ink"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth("login");
                  }}
                  className="flex-1 h-11 rounded-full border border-line-strong text-sm font-medium text-ink"
                >
                  Log in
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth("signup");
                  }}
                  className="flex-1 h-11 rounded-full bg-accent text-accent-ink text-sm font-semibold"
                >
                  Get started
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
