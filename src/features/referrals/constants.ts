const REFERRAL_USERNAME_PLACEHOLDER = "{username}";
export const REFERRAL_LINK = `https://tickx.finance/ref/${REFERRAL_USERNAME_PLACEHOLDER}`;
export const REFERRAL_BASE_URL = REFERRAL_LINK.replace(
  `/${REFERRAL_USERNAME_PLACEHOLDER}`,
  "",
);

export const buildReferralLink = (username?: string | null) => {
  const normalizedUsername = username?.trim();
  if (!normalizedUsername) {
    return REFERRAL_BASE_URL;
  }

  return REFERRAL_LINK.replace(
    REFERRAL_USERNAME_PLACEHOLDER,
    encodeURIComponent(normalizedUsername),
  );
};
