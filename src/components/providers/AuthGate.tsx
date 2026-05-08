"use client";

import { type ReactNode } from "react";

// AuthGate no longer blocks rendering — the app is publicly viewable.
// Individual features (betting, portfolio) check wallet connection themselves.
const AuthGate = ({ children }: { children: ReactNode }) => {
  return <>{children}</>;
};

export default AuthGate;
