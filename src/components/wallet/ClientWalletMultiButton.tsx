"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { WalletMultiButton as WalletMultiButtonComponent } from "@solana/wallet-adapter-react-ui";

type ClientWalletMultiButtonProps = ComponentProps<
  typeof WalletMultiButtonComponent
>;

const WalletMultiButtonNoSSR = dynamic<ClientWalletMultiButtonProps>(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (module) => module.WalletMultiButton,
    ),
  { ssr: false },
);

const ClientWalletMultiButton = (props: ClientWalletMultiButtonProps) => {
  return <WalletMultiButtonNoSSR {...props} />;
};

export default ClientWalletMultiButton;
