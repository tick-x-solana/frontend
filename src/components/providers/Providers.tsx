import DefaultLayout from "@/src/components/layout/DefaultLayout";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/src/components/shadcn/sonner";

const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <div>
      <NuqsAdapter>
        <DefaultLayout>{children}</DefaultLayout>
        <Toaster richColors position="top-right" />
      </NuqsAdapter>
    </div>
  );
};

export default Providers;
