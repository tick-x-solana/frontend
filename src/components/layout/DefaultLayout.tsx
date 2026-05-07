"use client";

import Header from "@/src/components/layout/Header";
import Footer from "@/src/components/layout/Footer";
import MobileBottomNav from "@/src/components/layout/MobileBottomNav";
import React from "react";
import { usePathname } from "next/navigation";

const DefaultLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const hideLayoutChrome = pathname === "/ref" || pathname.startsWith("/ref/");

  return (
    <div className="bg-background-main flex min-h-[100dvh] flex-col">
      {!hideLayoutChrome && <Header />}
      <main
        className={[
          "bg-background-main flex min-h-0 flex-1 flex-col",
          hideLayoutChrome
            ? "pb-0"
            : "pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-0",
        ].join(" ")}
      >
        {children}
      </main>
      {!hideLayoutChrome && (
        <>
          <div className="hidden md:block">
            <Footer />
          </div>
          <MobileBottomNav />
        </>
      )}
    </div>
  );
};

export default DefaultLayout;
