import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/src/components/shadcn/button";

export default function NotFound() {
  return (
    <section className="bg-background-main flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="flex max-w-md flex-col items-center text-center">
        <h1 className="text-text-heading text-3xl font-semibold">
          Page not found
        </h1>
        <p className="text-text-sub mt-3 text-sm">
          The page you are looking for does not exist.
        </p>
        <Link
          href="/"
          className={cn(
            buttonVariants({ size: "lg" }),
            "bg-primary-light text-text-inverse hover:bg-primary-medium mt-6 px-4 shadow-none",
          )}
        >
          Back to trade
        </Link>
      </div>
    </section>
  );
}
