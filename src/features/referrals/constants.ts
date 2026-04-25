export const WORLD_MINI_APP_BASE_URL = "https://worldcoin.org/mini-app";
const isProd = process.env.ENV === "dev";
export const TICKX_MINI_APP_ID = "app_fe8a4559be4f53707ad19a676492a4d6";

export const buildReferralPath = (username?: string | null) => {
  const normalizedUsername = username?.trim();
  if (!normalizedUsername) {
    return "/ref";
  }

  return `/ref/${encodeURIComponent(normalizedUsername)}`;
};

export const buildMiniAppReferralLink = (username?: string | null) =>
  `${WORLD_MINI_APP_BASE_URL}?app_id=${TICKX_MINI_APP_ID}&path=${buildReferralPath(username)}`;
