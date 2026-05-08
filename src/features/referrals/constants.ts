// Fallback for SSR; at runtime the browser origin is used instead
export const TICKX_APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://solana.tickx.finance";

const getAppBaseUrl = () => {
  if (typeof window !== "undefined") return window.location.origin;
  return TICKX_APP_BASE_URL;
};

export const buildReferralPath = (username?: string | null) => {
  const normalizedUsername = username?.trim();
  if (!normalizedUsername) {
    return "/ref";
  }

  return `/ref/${encodeURIComponent(normalizedUsername)}`;
};

export const buildMiniAppReferralLink = (username?: string | null) =>
  `${getAppBaseUrl()}${buildReferralPath(username)}`;
