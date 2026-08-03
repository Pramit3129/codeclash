"use client";

import { useState } from "react";
import { Navbar } from "@/components/ui/navbar";
import { HeroSection } from "@/components/hero/hero-section";
import { IDEMockup } from "@/components/hero/ide-mockup";
import { LiveTicker } from "@/components/sections/live-ticker";
import { FeaturesGrid } from "@/components/sections/features-grid";
import { HowItWorks } from "@/components/sections/how-it-works";
import { LeaderboardStats } from "@/components/sections/leaderboard-stats";
import { BadgeShowcase } from "@/components/sections/badge-showcase";
import { CTABanner } from "@/components/sections/cta-banner";
import { Footer } from "@/components/ui/footer";
import { AuthModal } from "@/components/auth/auth-modal";

export default function Home() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const handleOpenAuth = (mode: "login" | "signup") => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const handleWatchDemo = () => {
    // Scroll smoothly to IDE Mockup
    const mockupEl = document.getElementById("ide-mockup");
    if (mockupEl) {
      mockupEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-bg text-ink font-sans antialiased overflow-x-hidden">
      {/* Sticky Navigation */}
      <Navbar onOpenAuth={handleOpenAuth} />

      <main>
        {/* Hero Section */}
        <HeroSection onOpenAuth={handleOpenAuth} onWatchDemo={handleWatchDemo} />

        {/* Live IDE Battle Mockup */}
        <div id="ide-mockup">
          <IDEMockup />
        </div>

        {/* Season Badges & Pedestal Showcase */}
        <BadgeShowcase onOpenAuth={handleOpenAuth} />

        {/* Live Duel Activity Ticker */}
        <LiveTicker />

        {/* Features Bento Grid */}
        <FeaturesGrid />

        {/* How It Works & Match Simulator */}
        <HowItWorks onOpenAuth={handleOpenAuth} />

        {/* Live Leaderboard & Platform Stats */}
        <LeaderboardStats onOpenAuth={handleOpenAuth} />

        {/* CTA Banner */}
        <CTABanner onOpenAuth={handleOpenAuth} />
      </main>

      {/* Footer */}
      <Footer />

      {/* Interactive Auth Modal (Login / Signup with Local + GitHub + Google OAuth) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
      />
    </div>
  );
}
