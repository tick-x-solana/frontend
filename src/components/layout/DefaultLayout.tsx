import Header from "@/src/components/layout/Header";
import Footer from "@/src/components/layout/Footer";
import MobileBottomNav from "@/src/components/layout/MobileBottomNav";
import React from "react";

const DefaultLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="bg-background-main flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pb-[60px] md:pb-0">{children}</main>
      <div className="hidden md:block">
        <Footer />
      </div>
      <MobileBottomNav />
    </div>
  );
};

export default DefaultLayout;
