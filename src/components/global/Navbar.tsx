"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const Navbar = () => {
  const pathname = usePathname();
  const { data: session } = useSession();

  // If the user has never completed onboarding or is brand new,
  // Training tab sends them to /programs to pick a plan first.
  // Once they have a plan the training page handles itself.
  const isNewUser = session?.user?.isNewUser ?? false;
  const trainingHref = isNewUser ? "/programs" : "/training";

  const navItems = [
    {
      href: "/",
      label: "Home",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
          <path d="M9 21V12h6v9" />
        </svg>
      ),
    },
    {
      href: trainingHref,
      label: "Training",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 4v16M18 4v16M2 9h4M18 9h4M2 15h4M18 15h4" />
        </svg>
      ),
    },
    {
      href: "/progress",
      label: "Progress",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      ),
    },
    {
      href: "/settings",
      label: "Settings",
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      {/* Blur backdrop */}
      <div className="absolute inset-0 bg-sp-bg/90 backdrop-blur-xl border-t border-sp-border" />

      <div className="relative flex justify-around items-center h-16 px-2 max-w-105 mx-auto">
        {navItems.map((item) => {
          // Mark Training as active if we're on /training OR /programs
          // (since new users land on /programs via the Training tab)
          const active =
            item.label === "Training"
              ? pathname === "/training" || pathname === "/programs"
              : pathname === item.href;

          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex flex-col items-center justify-center gap-1 px-4 py-2 transition-all"
            >
              <span
                className={`transition-colors ${active ? "text-sp-accent" : "text-sp-muted"}`}
              >
                {item.icon}
              </span>
              <span
                className={`text-[10px] tracking-wide transition-colors ${active ? "text-sp-accent font-medium" : "text-sp-muted"}`}
              >
                {item.label}
              </span>
              {active && (
                <span className="absolute bottom-2 w-1 h-1 rounded-full bg-sp-accent" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default Navbar;
