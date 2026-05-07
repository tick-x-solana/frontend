const DEFAULT_LOCALE = "en-US";
const DEFAULT_EMPTY_WALLET_LABEL = "Not connected";

export const compactNumberFormatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const fixedTwoDecimalFormatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const integerNumberFormatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
  maximumFractionDigits: 0,
});

export const oneDecimalFormatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const upToOneDecimalFormatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export const usdCurrencyFormatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const fixedTwoDecimalUsdCurrencyFormatter = new Intl.NumberFormat(
  DEFAULT_LOCALE,
  {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
);

type FormatApproxUsdOptions = {
  includeApproxPrefix?: boolean;
};

type FormatWalletAddressOptions = {
  emptyLabel?: string;
  start?: number;
  end?: number;
  minLength?: number;
};

export function formatCompactNumber(value: number): string {
  return compactNumberFormatter.format(value);
}

export function formatFixedTwoDecimal(value: number): string {
  return fixedTwoDecimalFormatter.format(value);
}

export function formatIntegerNumber(value: number): string {
  return integerNumberFormatter.format(value);
}

export function formatOneDecimalNumber(value: number): string {
  return oneDecimalFormatter.format(value);
}

export function formatUpToOneDecimalNumber(value: number): string {
  return upToOneDecimalFormatter.format(value);
}

export function formatApproxUsd(
  amountWld: number,
  priceUsd: number | null,
  options: FormatApproxUsdOptions = {},
): string | null {
  if (typeof priceUsd !== "number" || !Number.isFinite(priceUsd) || priceUsd <= 0) {
    return null;
  }

  const prefix = options.includeApproxPrefix ? "~$" : "$";
  return `${prefix}${fixedTwoDecimalFormatter.format(amountWld * priceUsd)}`;
}

export function formatUsdCurrency(value: number | string): string {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return "$0";
  }

  return usdCurrencyFormatter.format(numericValue);
}

export function formatUsdCurrencyFixedTwo(value: number | string): string {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return "$0.00";
  }

  return fixedTwoDecimalUsdCurrencyFormatter.format(numericValue);
}

export function formatWalletAddress(
  address: string | null | undefined,
  options: FormatWalletAddressOptions = {},
): string {
  const {
    emptyLabel = DEFAULT_EMPTY_WALLET_LABEL,
    start = 6,
    end = 4,
    minLength = start + end + 2,
  } = options;

  if (!address) return emptyLabel;
  if (!address.startsWith("0x") || address.length < minLength) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}
