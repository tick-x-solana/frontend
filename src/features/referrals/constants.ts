export const WORLD_MINI_APP_BASE_URL = "https://worldcoin.org/mini-app";
export const TICKX_MINI_APP_ID = "app_e35e8aaf83112cf2c4c4470fda05c7b2";

export const buildReferralPath = (username?: string | null) => {
  const normalizedUsername = username?.trim();
  if (!normalizedUsername) {
    return "/ref";
  }

  return `/ref/${encodeURIComponent(normalizedUsername)}`;
};

export const buildMiniAppReferralLink = (username?: string | null) =>
  `${WORLD_MINI_APP_BASE_URL}?app_id=${TICKX_MINI_APP_ID}&path=${buildReferralPath(username)}`;
