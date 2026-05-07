/**
 * useMarketSelector — manages the active market symbol and its derived socket/REST
 * path segments. Exposes a `handleMarketChange` callback that delegates full visual
 * and runtime reset to the caller via `onMarketReset`.
 */

import { useState, useMemo, useCallback } from "react";
import { MARKET_SYMBOL } from "../components/tradingGrid.constants";
import { toMarketId, toMarketSocketSegment } from "../components/tradingGrid.utils";

export function useMarketSelector({
  resetGridData,
  onMarketReset,
}: {
  resetGridData: () => void;
  onMarketReset: () => void;
}) {
  const [selectedMarketSymbol, setSelectedMarketSymbol] = useState(MARKET_SYMBOL);

  const selectedMarketId = useMemo(
    () => toMarketId(selectedMarketSymbol),
    [selectedMarketSymbol],
  );

  const marketSocketSegment = useMemo(
    () => toMarketSocketSegment(selectedMarketSymbol),
    [selectedMarketSymbol],
  );

  const marketSocketPath = useMemo(
    () => `/market/${marketSocketSegment}/socket.io`,
    [marketSocketSegment],
  );

  const handleMarketChange = useCallback(
    (nextMarketSymbol: string) => {
      if (nextMarketSymbol === selectedMarketSymbol) return;
      setSelectedMarketSymbol(nextMarketSymbol);
      resetGridData();
      onMarketReset();
    },
    [selectedMarketSymbol, resetGridData, onMarketReset],
  );

  return {
    selectedMarketSymbol,
    selectedMarketId,
    marketSocketSegment,
    marketSocketPath,
    handleMarketChange,
  };
}
