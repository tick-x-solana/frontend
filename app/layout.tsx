import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/src/components/providers/Providers";

const interDisplay = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  fallback: ["Inter Display", "Inter", "system-ui", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TickX",
  description: "TickX",
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
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
