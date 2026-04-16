import type { Metadata } from "next";
import { Barlow_Condensed, DM_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-barlow",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sporty Pulse Pro",
  description: "Your personal coaching platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${barlow.variable} ${dmSans.variable}`}>
      <body className="bg-sp-bg text-sp-text font-dm">
        <div className="min-h-screen flex justify-center">
          {/* APP CONTAINER */}
          <div className="w-full max-w-105">
            <Providers>{children}</Providers>
          </div>
        </div>
      </body>
    </html>
  );
}
