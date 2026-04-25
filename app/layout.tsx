import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/src/components/providers/Providers";

const interDisplay = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  // Reduce visible font swapping on first paint.
  display: "optional",
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
  preload: true,
  adjustFontFallback: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TickX",
  description: "TickX",
  icons: {
    icon: "/tickX.png",
    shortcut: "/tickX.png",
    apple: "/tickX.png",
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
      className={`${interDisplay.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preload" href="/bet-win.svg" as="image" type="image/svg+xml" />
      </head>
      <body className="flex min-h-full flex-col overscroll-y-none">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
