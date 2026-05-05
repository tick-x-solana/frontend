export const truncateAddress = (
  address: string,
  start: number = 6,
  end: number = 4,
) => {
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatCurrency = (value: number | string) => {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return "$0";
  }

  return currencyFormatter.format(numericValue);
};
