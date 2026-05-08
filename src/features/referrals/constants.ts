export const TICKX_APP_BASE_URL = "https://solana.tickx.finance";

export const buildReferralPath = (username?: string | null) => {
  const normalizedUsername = username?.trim();
  if (!normalizedUsername) {
    return "/ref";
  }

  return `/ref/${encodeURIComponent(normalizedUsername)}`;
};

export const buildMiniAppReferralLink = (username?: string | null) =>
  `${TICKX_APP_BASE_URL}${buildReferralPath(username)}`;
