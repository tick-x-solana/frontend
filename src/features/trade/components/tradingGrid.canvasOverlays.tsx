import React, { memo, useMemo } from "react";
import Image from "next/image";
import { Share2 } from "lucide-react";
import { BetWinEffect } from "./BetWinEffect";
import type { ActiveWinEffectState, ShareOverlayTarget } from "./tradingGrid.utils";
import { formatApproxUsd } from "./tradingGrid.utils";

type WinEffectsLayerProps = {
  shareOverlayTargets: ShareOverlayTarget[];
  activeWinEffectCellIdSet: Set<string>;
  activeWinEffectByCellId: Record<string, ActiveWinEffectState>;
  setWinEffectIconRef: (cellId: string, node: HTMLDivElement | null) => void;
  solUsdPrice: number | null | undefined;
  plotWidth: number;
  plotHeight: number;
};

type WinEffectItemProps = {
  target: ShareOverlayTarget;
  effectState: ActiveWinEffectState;
  setWinEffectIconRef: (cellId: string, node: HTMLDivElement | null) => void;
  solUsdPrice: number | null | undefined;
};

const WinEffectItem = memo(function WinEffectItem({
  target,
  effectState,
  setWinEffectIconRef,
  solUsdPrice,
}: WinEffectItemProps) {
  return (
    <div
      key={`${target.cellId}-win-icon-${effectState.startedAt}`}
      ref={(node) => setWinEffectIconRef(target.cellId, node)}
      className="absolute top-0 left-0 h-[200px] w-[200px]"
      style={{
        transform: `translate3d(${target.centerLeft}px, ${target.centerTop}px, 0) translate(-50%, -50%)`,
      }}
      aria-hidden
    >
      <BetWinEffect />
      {effectState.showTotal ? (
        <div
          key={`${target.cellId}-total-wrap-${effectState.startedAt}`}
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <span
            className="win-pop-total text-success-medium block font-extrabold tracking-[-0.03em] whitespace-nowrap drop-shadow-[0_0_14px_rgb(17_211_68_/_0.68)]"
            style={{
              fontSize: `${Math.max(11, Math.min(20, Math.round(target.cellEdge * 0.24)))}px`,
            }}
          >
            +{formatApproxUsd(target.totalPayout, solUsdPrice ?? null) ?? "$--"}
          </span>
        </div>
      ) : (
        <div
          key={`${target.cellId}-amounts-${effectState.startedAt}`}
          className="win-pop-amounts pointer-events-none absolute flex items-center gap-1.5 whitespace-nowrap"
          style={{ top: "100px", left: "100px" }}
        >
          <span
            className="text-success-medium font-extrabold tracking-[-0.03em] drop-shadow-[0_0_12px_rgb(17_211_68_/_0.66)]"
            style={{
              fontSize: `${Math.max(10, Math.min(18, Math.round(target.cellEdge * 0.2)))}px`,
            }}
          >
            +{formatApproxUsd(target.basePayout, solUsdPrice ?? null) ?? "$--"}
          </span>
          {target.bonusPayout > 0 ? (
            <span
              className="text-grid-accent font-extrabold tracking-[-0.03em] drop-shadow-[0_0_12px_rgb(18_221_255_/_0.72)]"
              style={{
                fontSize: `${Math.max(10, Math.min(18, Math.round(target.cellEdge * 0.2)))}px`,
              }}
            >
              +{formatApproxUsd(target.bonusPayout, solUsdPrice ?? null) ?? "$--"}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
});

export const WinEffectsLayer = memo(function WinEffectsLayer(
  props: WinEffectsLayerProps,
) {
  const {
    shareOverlayTargets,
    activeWinEffectCellIdSet,
    activeWinEffectByCellId,
    setWinEffectIconRef,
    solUsdPrice,
    plotWidth,
    plotHeight,
  } = props;

  const activeTargets = useMemo(
    () =>
      shareOverlayTargets.filter((target) =>
        activeWinEffectCellIdSet.has(target.cellId),
      ),
    [activeWinEffectCellIdSet, shareOverlayTargets],
  );

  return (
    <div
      className="pointer-events-none absolute top-0 left-0 z-20 overflow-hidden"
      style={{ width: `${plotWidth}px`, height: `${plotHeight}px` }}
    >
      {activeTargets.map((target) => {
        const effectState = activeWinEffectByCellId[target.cellId];
        if (!effectState) return null;
        return (
          <WinEffectItem
            key={`${target.cellId}-win-icon-${effectState.startedAt}`}
            target={target}
            effectState={effectState}
            setWinEffectIconRef={setWinEffectIconRef}
            solUsdPrice={solUsdPrice}
          />
        );
      })}
    </div>
  );
});

type ShareButtonsLayerProps = {
  shareOverlayTargets: ShareOverlayTarget[];
  setShareOverlayButtonRef: (cellId: string, node: HTMLButtonElement | null) => void;
  handleOpenShareSheet: (cellId: string) => void;
  plotWidth: number;
  plotHeight: number;
};

export const ShareButtonsLayer = memo(function ShareButtonsLayer({
  shareOverlayTargets,
  setShareOverlayButtonRef,
  handleOpenShareSheet,
  plotWidth,
  plotHeight,
}: ShareButtonsLayerProps) {
  return (
    <div
      className="pointer-events-none absolute top-0 left-0 z-20 overflow-hidden"
      style={{ width: `${plotWidth}px`, height: `${plotHeight}px` }}
    >
      {shareOverlayTargets.map((target) => (
        <button
          key={target.cellId}
          ref={(node) => setShareOverlayButtonRef(target.cellId, node)}
          type="button"
          className="bg-background-main/90 border-border-main text-grid-accent pointer-events-auto absolute top-0 left-0 flex items-center justify-center rounded-md border shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
          style={{
            transform: `translate3d(${target.left}px, ${target.top}px, 0)`,
            width: `${target.buttonSize}px`,
            height: `${target.buttonSize}px`,
          }}
          onClick={(event) => {
            event.stopPropagation();
            handleOpenShareSheet(target.cellId);
          }}
          aria-label="Share winning cell"
        >
          <Share2 className="h-1/2 w-1/2 shrink-0" strokeWidth={2} />
        </button>
      ))}
    </div>
  );
});
