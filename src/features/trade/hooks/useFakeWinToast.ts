import { useEffect, useState } from "react";
import type { FakeWinToastData } from "@/src/features/trade/components/tradingGrid.utils";
import {
  FAKE_WIN_TOAST_MAX_DELAY_MS,
  FAKE_WIN_TOAST_MIN_DELAY_MS,
  FAKE_WIN_TOAST_VISIBLE_MS,
} from "@/src/features/trade/components/tradingGrid.constants";
import { buildFakeWinToastData, randomInt } from "@/src/features/trade/components/tradingGrid.utils";

export default function useFakeWinToast() {
  const [fakeWinToastData, setFakeWinToastData] = useState<FakeWinToastData | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let nextToastTimerId: ReturnType<typeof setTimeout> | null = null;
    let hideToastTimerId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextToast = () => {
      if (isCancelled) return;

      nextToastTimerId = setTimeout(() => {
        if (isCancelled) return;

        setFakeWinToastData(buildFakeWinToastData());
        if (hideToastTimerId) clearTimeout(hideToastTimerId);

        hideToastTimerId = setTimeout(() => {
          if (isCancelled) return;
          setFakeWinToastData(null);
        }, FAKE_WIN_TOAST_VISIBLE_MS);

        scheduleNextToast();
      }, randomInt(FAKE_WIN_TOAST_MIN_DELAY_MS, FAKE_WIN_TOAST_MAX_DELAY_MS));
    };

    scheduleNextToast();

    return () => {
      isCancelled = true;
      if (nextToastTimerId) clearTimeout(nextToastTimerId);
      if (hideToastTimerId) clearTimeout(hideToastTimerId);
    };
  }, []);

  return fakeWinToastData;
}
