const isBrowser = typeof window !== "undefined";

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  (!isBrowser ? process.env.BACKEND_URL : undefined) ||
  "https://api-tick-x.nysm.work";
