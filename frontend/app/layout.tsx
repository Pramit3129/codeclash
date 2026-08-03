import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "CodeClash — Real-Time Competitive Coding",
  description:
    "Battle developers worldwide in live 1v1 coding duels. Sharpen your DSA skills, climb global leaderboards, and win real-time contests.",
  openGraph: {
    title: "CodeClash — Real-Time Competitive Coding",
    description:
      "Battle developers worldwide in live 1v1 coding duels. Sharpen your DSA skills, climb global leaderboards.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} dark h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("codeclash-theme")==="light"){document.documentElement.classList.remove("dark")}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-ink font-sans">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 bg-noise opacity-[0.035]"
        />
        {children}
      </body>
    </html>
  );
}
