import Link from "next/link";

const Footer = () => {
  return (
    <footer className="border-[#0f2742] border-t bg-[#041026] px-4 py-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] leading-4 font-medium tracking-[-0.01em] text-[#587994]">
          TickX ©️ 2026. All rights reserved.
        </p>

        <div className="flex items-center gap-8 text-[12px] leading-4 font-medium tracking-[-0.01em] text-[#6f8ea7]">
          <Link href="#" className="transition-colors hover:text-[#9eb6c8]">
            Docs
          </Link>
          <Link href="#" className="transition-colors hover:text-[#9eb6c8]">
            Academic Paper
          </Link>
          <span className="h-[11px] w-px bg-[#0f2742]" aria-hidden />
          <div className="flex items-center gap-2">
            <Link href="#" className="transition-colors hover:text-[#9eb6c8]">
              Twitter
            </Link>
            <span aria-hidden>·</span>
            <Link href="#" className="transition-colors hover:text-[#9eb6c8]">
              Facebook
            </Link>
            <span aria-hidden>·</span>
            <Link href="#" className="transition-colors hover:text-[#9eb6c8]">
              Discord
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
