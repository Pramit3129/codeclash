"use client";

import { Disc as Discord } from "lucide-react";

const LINK_COLUMNS = [
  {
    title: "Product",
    links: ["Features", "Problems", "Contests", "Leaderboard", "Pricing"],
  },
  {
    title: "Company",
    links: ["About", "Blog", "Careers", "Contact"],
  },
  {
    title: "Resources",
    links: ["Docs", "API", "Status", "Changelog"],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface/50 pt-16 pb-10">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10 pb-12 border-b border-line">
          {/* Brand */}
          <div className="col-span-2 space-y-4">
            <a href="#" className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-md bg-accent text-accent-ink font-mono font-bold text-[13px] flex items-center justify-center">
                {"</>"}
              </span>
              <span className="text-[17px] font-semibold tracking-tight">
                CodeClash
              </span>
            </a>
            <p className="text-sm text-ink-2 leading-relaxed max-w-sm">
              The multiplayer coding arena where developers battle in real time,
              sharpen DSA skills, and climb global rankings.
            </p>
            <div className="flex items-center gap-2.5 pt-1">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                className="w-9 h-9 rounded-full border border-line bg-surface text-ink-2 hover:text-ink hover:border-line-strong transition-colors flex items-center justify-center shadow-soft"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
                </svg>
              </a>
              <a
                href="https://discord.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Discord"
                className="w-9 h-9 rounded-full border border-line bg-surface text-ink-2 hover:text-ink hover:border-line-strong transition-colors flex items-center justify-center shadow-soft"
              >
                <Discord className="w-4 h-4" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                aria-label="X (Twitter)"
                className="w-9 h-9 rounded-full border border-line bg-surface text-ink-2 hover:text-ink hover:border-line-strong transition-colors flex items-center justify-center shadow-soft"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117Z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Link columns */}
          {LINK_COLUMNS.map((column) => (
            <div key={column.title}>
              <h4 className="text-sm font-semibold tracking-tight text-ink">
                {column.title}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-ink-2 hover:text-ink transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Community */}
          <div>
            <h4 className="text-sm font-semibold tracking-tight text-ink">
              Community
            </h4>
            <ul className="mt-4 space-y-2.5">
              {["GitHub", "Discord", "X (Twitter)"].map((link) => (
                <li key={link}>
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-ink-2 hover:text-ink transition-colors"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Legal */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-ink-3">
          <p>© 2026 CodeClash. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-ink transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-ink transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
