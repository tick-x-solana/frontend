type WorldChatShareMetrics = {
  winRate?: string | number | null;
  roi?: string | number | null;
};

type BuildWorldChatShareMessageParams = {
  referralCode: string;
  referralLink: string;
  introLine?: string;
  metrics?: WorldChatShareMetrics;
};

function normalizeMetricValue(value: string | number | null | undefined) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return `${value}`;
  }

  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildWorldChatShareMessage({
  referralCode,
  referralLink,
  introLine = "Use my referral to follow trade on TickX.",
  metrics,
}: BuildWorldChatShareMessageParams) {
  const normalizedWinRate = normalizeMetricValue(metrics?.winRate);
  const normalizedRoi = normalizeMetricValue(metrics?.roi);

  const lines = [
    introLine,
    normalizedWinRate ? `Win Rate: ${normalizedWinRate}` : null,
    normalizedRoi ? `ROI: ${normalizedRoi}` : null,
    `Referral code: ${referralCode}`,
    `Link: ${referralLink}`,
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n");
}

export type { WorldChatShareMetrics };
