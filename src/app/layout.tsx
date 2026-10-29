import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { UnitBadge } from "@/components/UnitBadge";

const display = Fraunces({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600"] });
const body = Geist({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Is it working?",
  description: "Test your skincare like a dermatologist would: one side of your face, same photo, real numbers, and an honest answer — including “not yet”.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f6f2ec" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>
        <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col px-4">
          <header className="flex items-center justify-between py-4">
            <Link href="/" className="display text-xl font-semibold">
              Is it working?
            </Link>
            <div className="flex items-center gap-3 text-sm">
              <UnitBadge />
              <Link href="/about" className="text-muted underline-offset-4 hover:underline">
                How it works
              </Link>
            </div>
          </header>
          <main className="flex-1 pb-10">{children}</main>
          <footer className="border-t border-line py-5 text-xs leading-relaxed text-muted">
            This is not medical advice. See a dermatologist for skin conditions. Your photos and results stay on this
            device; each photo is sent to the YouCam API only to be analysed.
          </footer>
        </div>
      </body>
    </html>
  );
}
