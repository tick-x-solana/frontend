type WorldChatShareMetrics = {
  winRate?: string | number | null;
  pnl?: string | number | null;
  roi?: string | number | null;
};

type BuildWorldChatShareMessageParams = {
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
  referralLink,
  introLine = "Hey! I just won big! Follow my trades on TickX",
  metrics,
}: BuildWorldChatShareMessageParams) {
  const normalizedWinRate = normalizeMetricValue(metrics?.winRate);
  const normalizedPnl = normalizeMetricValue(metrics?.pnl);
  const normalizedRoi = normalizeMetricValue(metrics?.roi);

  const lines = [
    introLine,
    normalizedWinRate ? `Win rate: ${normalizedWinRate}` : null,
    normalizedPnl ? `PnL: ${normalizedPnl}` : null,
    normalizedRoi ? `ROI: ${normalizedRoi}` : null,
    `Link: ${referralLink}`,
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n");
}

export type { WorldChatShareMetrics };
