import {
  formatUsdCurrency,
  formatWalletAddress,
} from "@/src/utils/formatters";

export const truncateAddress = (
  address: string,
  start: number = 6,
  end: number = 4,
) => {
  return formatWalletAddress(address, {
    emptyLabel: "",
    start,
    end,
    minLength: start + end,
  });
};

export const formatCurrency = (value: number | string) => {
  return formatUsdCurrency(value);
};
