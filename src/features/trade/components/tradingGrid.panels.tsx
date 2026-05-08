import React from "react";
import { Copy, Eye, Info, LocateFixed, Share2, Wallet } from "lucide-react";
import HamburgerMenuIcon from "@/src/assets/icons/hamburger-menu.svg";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/src/components/shadcn/dialog";
import { Button } from "@/src/components/shadcn/button";
import { MOBILE_VIEWPORT_BREAKPOINT_PX } from "@/src/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/src/components/shadcn/select";
import { Sheet } from "react-modal-sheet";
import { cn } from "@/lib/utils";
import OverlayModePanel from "@/src/features/trade/components/OverlayModePanel";
import TradingOrdersPanel from "@/src/features/trade/components/TradingOrdersPanel";
import TradeControlsPanel from "@/src/features/trade/components/TradeControlsPanel";
import { WinShareCard } from "@/src/features/trade/components/WinShareCard";
import { GridActionButton } from "./tradingGrid.ui";
import { MARKET_OPTIONS } from "./tradingGrid.constants";
import { formatWalletAddress } from "@/src/utils/formatters";

type TopBarProps = {
  selectedMarketSymbol: string;
  displayMarketPrice: string;
  isSuggestedStrategyVisible: boolean;
  isFollowTradeVisible: boolean;
  isOrdersVisible: boolean;
  onMarketChange: (marketSymbol: string) => void;
  onOpenInfo: () => void;
  onOpenOrders: () => void;
  onOpenOverlay: () => void;
  onRecenter: () => void;
};

export function TradingGridTopBar({
  selectedMarketSymbol,
  displayMarketPrice,
  isSuggestedStrategyVisible,
  isFollowTradeVisible,
  isOrdersVisible,
  onMarketChange,
  onOpenInfo,
  onOpenOrders,
  onOpenOverlay,
  onRecenter,
}: TopBarProps) {
  const selectedOption =
    MARKET_OPTIONS.find((option) => option.symbol === selectedMarketSymbol) ??
    MARKET_OPTIONS[0];

  return (
    <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex items-center justify-between gap-3 sm:inset-x-3">
      <div className="flex min-w-0 items-center gap-1">
        <Select value={selectedMarketSymbol} onValueChange={onMarketChange}>
          <SelectTrigger className="bg-surface-control border-border-main pointer-events-auto h-8 shrink-0 gap-1 rounded-[8px] px-1 text-white">
            <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedOption?.iconSrc ?? "/btc.png"}
                alt=""
                className="h-full w-full object-contain"
              />
            </span>
            <span className="text-sm font-semibold tracking-[-0.01em]">
              {selectedMarketSymbol}
            </span>
          </SelectTrigger>
          <SelectContent className="bg-surface-control border-border-main w-[150px] p-1">
            {MARKET_OPTIONS.map((option) => (
              <SelectItem
                key={option.symbol}
                value={option.symbol}
                disabled={!option.enabled}
                className={cn(
                  "rounded-[8px] px-2 py-1.5 text-sm font-semibold tracking-[-0.01em]",
                  option.enabled
                    ? "focus:bg-surface-control-active text-white focus:text-white"
                    : "text-text-sub opacity-60",
                )}
              >
                <span className="inline-flex w-full items-center gap-2">
                  {option.iconSrc ? (
                    <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={option.iconSrc}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    </span>
                  ) : (
                    <span className="bg-surface-control-active text-text-sub flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                      {option.shortLabel}
                    </span>
                  )}
                  <span>{option.symbol}</span>
                  {!option.enabled ? (
                    <span className="text-hint ml-auto text-[10px] uppercase">
                      Soon
                    </span>
                  ) : null}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-text-sub truncate text-xs font-semibold tracking-[-0.01em]">
          {displayMarketPrice}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <GridActionButton aria-label="Market info" onClick={onOpenInfo}>
          <Info className="size-4" strokeWidth={1.75} />
        </GridActionButton>
        <GridActionButton
          aria-label="Open user bet orders"
          active={isOrdersVisible}
          onClick={onOpenOrders}
        >
          <HamburgerMenuIcon className="size-4" aria-hidden="true" />
        </GridActionButton>
        <GridActionButton
          aria-label={
            isSuggestedStrategyVisible || isFollowTradeVisible
              ? "Overlay filters enabled. Open overlay settings"
              : "Open overlay settings"
          }
          aria-haspopup="dialog"
          active={isSuggestedStrategyVisible || isFollowTradeVisible}
          onClick={onOpenOverlay}
        >
          <Eye className="size-4" strokeWidth={1.75} />
        </GridActionButton>
        <GridActionButton
          aria-label="Recenter trading grid"
          onClick={onRecenter}
        >
          <LocateFixed className="size-4" strokeWidth={1.75} />
        </GridActionButton>
      </div>
    </div>
  );
}

type FollowReferralDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  followReferralCode: string | null;
  followReferralHandle: string | null;
  isFollowReferralAlreadyActive: boolean;
  resolvedFollowTargetWallet: string | null;
  followReferralStats: ReadonlyArray<{
    label: string;
    value: string;
    color: string;
  }>;
  formatWalletShort: (value: string) => string;
  isSubmittingFollowReferral: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function FollowReferralDialog(props: FollowReferralDialogProps) {
  const {
    isOpen,
    onOpenChange,
    followReferralCode,
    followReferralHandle,
    isFollowReferralAlreadyActive,
    resolvedFollowTargetWallet,
    followReferralStats,
    formatWalletShort,
    isSubmittingFollowReferral,
    onCancel,
    onConfirm,
  } = props;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="pointer-events-none">
        <div className="border-border-main pointer-events-auto w-full max-w-[540px] rounded-[20px] border bg-[linear-gradient(112deg,var(--background-main)_0%,var(--surface-card-strong)_62%,var(--background-main)_100%)] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4">
            <DialogTitle className="text-text-heading text-xl font-semibold tracking-[-0.01em]">
              Start Follow Trade
            </DialogTitle>
            <DialogDescription className="text-text-sub text-sm font-medium tracking-[-0.01em]">
              {followReferralCode
                ? `Follow ${followReferralHandle ? `${formatWalletAddress(followReferralHandle)}` : "this trader"} directly from this shared link.`
                : "Follow this trader directly from the shared link."}
            </DialogDescription>

            <div className="bg-surface-overlay-subtle border-border-main rounded-[12px] border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-text-heading text-sm font-semibold tracking-[-0.01em]">
                  Trader Snapshot
                </p>
                <span
                  className={cn(
                    "rounded-[999px] border px-2 py-0.5 text-[11px] font-semibold tracking-[-0.01em]",
                    isFollowReferralAlreadyActive
                      ? "bg-success-background border-success-border text-success-medium"
                      : "bg-surface-overlay border-border-main text-text-sub",
                  )}
                >
                  {isFollowReferralAlreadyActive ? "Following" : "New Follow"}
                </span>
              </div>

              {resolvedFollowTargetWallet ? (
                <p className="text-text-sub mb-3 flex items-center gap-1.5 text-xs tracking-[-0.01em]">
                  <Wallet className="size-3.5" aria-hidden="true" />
                  Trader wallet: {formatWalletShort(resolvedFollowTargetWallet)}
                </p>
              ) : null}

              <div className="flex items-center">
                {followReferralStats.map((item, index) => (
                  <div
                    key={item.label}
                    className={cn(
                      "flex flex-1 flex-col gap-1 px-3 first:pl-0 last:pr-0",
                      index !== 0 && "border-border-main border-l",
                    )}
                  >
                    <p className="text-text-sub text-xs font-medium tracking-[-0.01em]">
                      {item.label}
                    </p>
                    <p
                      className={cn(
                        "text-sm font-semibold tracking-[-0.01em]",
                        item.color,
                      )}
                    >
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmittingFollowReferral}
                className="border-border-main text-text-inverse hover:text-text-inverse h-11 rounded-[10px] bg-white hover:bg-white/90 disabled:opacity-100"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={onConfirm}
                disabled={
                  isSubmittingFollowReferral || isFollowReferralAlreadyActive
                }
                className="bg-primary-medium text-text-inverse hover:bg-primary-light h-11 rounded-[10px]"
              >
                {isSubmittingFollowReferral
                  ? "Processing..."
                  : isFollowReferralAlreadyActive
                    ? "Following"
                    : "Follow"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type InfoSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  marketSymbol: string;
  displayPrice: string;
};

export function TradingInfoSheet({
  isOpen,
  onClose,
  marketSymbol,
  displayPrice,
}: InfoSheetProps) {
  return (
    <Sheet isOpen={isOpen} onClose={onClose} detent="content" unstyled>
      <Sheet.Backdrop
        onTap={onClose}
        className="bg-background-main/55 backdrop-blur-[2px]"
      />
      <Sheet.Container className="pointer-events-none">
        <Sheet.Content
          disableDrag={false}
          className="border-border-main bg-background-main pointer-events-auto rounded-t-[16px] border-t px-5 pt-3 pb-5"
        >
          <TradeControlsPanel
            marketSymbol={marketSymbol}
            displayPrice={displayPrice}
            showMarketHeader
            showHandle
            showCloseButton={false}
            showInlineOrders={false}
            onClose={onClose}
          />
        </Sheet.Content>
      </Sheet.Container>
    </Sheet>
  );
}

type OrdersSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  marketSymbol: string;
  queryAnchorTime: number | null;
};

export function TradingOrdersSheet({
  isOpen,
  onClose,
  marketSymbol,
  queryAnchorTime,
}: OrdersSheetProps) {
  return (
    <Sheet isOpen={isOpen} onClose={onClose} detent="content" unstyled>
      <Sheet.Backdrop
        onTap={onClose}
        className="bg-background-main/55 backdrop-blur-[2px]"
      />
      <Sheet.Container className="pointer-events-none">
        <Sheet.Content
          disableDrag={false}
          className="border-border-main bg-background-main pointer-events-auto rounded-t-[16px] border-t px-5 pt-3 pb-5"
        >
          <div className="flex flex-col gap-4">
            <div className="flex justify-center">
              <span
                className="bg-grid-axis/70 h-1 w-20 rounded-full"
                aria-hidden
              />
            </div>
            <TradingOrdersPanel
              className="border-0 bg-transparent p-0"
              fallbackMarketLabel={marketSymbol}
              queryAnchorTime={queryAnchorTime}
            />
          </div>
        </Sheet.Content>
      </Sheet.Container>
    </Sheet>
  );
}

type OverlaySheetProps = {
  isOpen: boolean;
  onClose: () => void;
  suggestedStrategyEnabledDraft: boolean;
  followTradeEnabledDraft: boolean;
  followTradeTargetsDraft: Array<{
    id: string;
    label: string;
    subtitle: string;
    enabled: boolean;
  }>;
  isFollowingFetching: boolean;
  onSuggestedStrategyDraftChange: (value: boolean) => void;
  onFollowTradeDraftChange: (value: boolean) => void;
  onFollowTradeTargetDraftChange: (
    targetUserId: string,
    value: boolean,
  ) => void;
  onApplyOverlayMode: () => void;
};

export function TradingOverlaySheet(props: OverlaySheetProps) {
  const {
    isOpen,
    onClose,
    suggestedStrategyEnabledDraft,
    followTradeEnabledDraft,
    followTradeTargetsDraft,
    isFollowingFetching,
    onSuggestedStrategyDraftChange,
    onFollowTradeDraftChange,
    onFollowTradeTargetDraftChange,
    onApplyOverlayMode,
  } = props;

  return (
    <Sheet isOpen={isOpen} onClose={onClose} detent="content" unstyled>
      <Sheet.Backdrop
        onTap={onClose}
        className="bg-background-main/55 backdrop-blur-[2px]"
      />
      <Sheet.Container className="pointer-events-none">
        <Sheet.Content
          disableDrag={false}
          className="border-border-main bg-background-main pointer-events-auto rounded-t-[16px] border-t px-5 pt-3 pb-5"
        >
          <OverlayModePanel
            suggestedStrategyEnabled={suggestedStrategyEnabledDraft}
            followTradeEnabled={followTradeEnabledDraft}
            followTradeTargets={followTradeTargetsDraft}
            isFollowTradeLoading={isFollowingFetching}
            onSuggestedStrategyEnabledChange={onSuggestedStrategyDraftChange}
            onFollowTradeEnabledChange={onFollowTradeDraftChange}
            onFollowTradeTargetEnabledChange={onFollowTradeTargetDraftChange}
            onApply={onApplyOverlayMode}
          />
        </Sheet.Content>
      </Sheet.Container>
    </Sheet>
  );
}

type ShareSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  marketSymbol: string;
  selectedShareCell: { multiplier: number } | null;
  selectedShareAmountUsd: number;
  selectedShareTime: string;
  selectedShareProfitUsd: number;
  shareUrl: string;
  copyShareLink: () => void;
  isSharing: boolean;
  share: () => void;
  shareWinRate: string | null;
  selectedShareRoi: string | null;
};

export function TradingShareSheet(props: ShareSheetProps) {
  const {
    isOpen,
    onClose,
    marketSymbol,
    selectedShareCell,
    selectedShareAmountUsd,
    selectedShareTime,
    selectedShareProfitUsd,
    shareUrl,
    copyShareLink,
    isSharing,
    share,
  } = props;
  const isDesktopViewport = React.useSyncExternalStore(
    subscribeDesktopShareViewport,
    getDesktopShareViewportSnapshot,
    getDesktopShareViewportServerSnapshot,
  );

  const shareContent = selectedShareCell ? (
    <div className="mx-auto w-full max-w-[400px]">
      <WinShareCard
        marketSymbol={marketSymbol}
        multiplier={selectedShareCell.multiplier}
        amount={selectedShareAmountUsd}
        openedAt={selectedShareTime}
        profit={selectedShareProfitUsd}
      />
      <div className="px-5 pb-5">
        <div className="flex flex-col gap-4">
          <p className="text-hint text-sm font-medium tracking-[-0.01em]">
            Share your win
          </p>
          <div className="bg-surface-overlay rounded-[8px] px-3 py-2">
            <div className="flex items-center gap-2">
              <p className="text-text-heading min-w-0 flex-1 truncate text-sm font-medium tracking-[-0.01em]">
                {shareUrl}
              </p>
              <button
                type="button"
                className="text-text-sub hover:text-text-heading flex size-5 items-center justify-center"
                onClick={copyShareLink}
                aria-label="Copy share link"
              >
                <Copy className="size-4" strokeWidth={1.9} />
              </button>
            </div>
          </div>
          <Button
            type="button"
            className="bg-primary-medium text-text-inverse hover:bg-primary-light h-11 rounded-[8px] text-base font-medium tracking-[-0.01em]"
            onClick={share}
            disabled={isSharing}
          >
            <Share2 className="mr-2 size-4" strokeWidth={1.9} />
            {isSharing ? "Sharing..." : "Share"}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  if (isDesktopViewport) {
    return (
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent className="pointer-events-none inset-auto top-1/2 left-1/2 block w-auto max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 p-0">
          <div className="border-border-main bg-background-main pointer-events-auto w-[min(440px,calc(100vw-2rem))] overflow-hidden rounded-[20px] border shadow-[0_24px_100px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.04)]">
            <DialogTitle className="sr-only">Share your win</DialogTitle>
            <DialogDescription className="sr-only">
              Share your winning bet link.
            </DialogDescription>
            {shareContent}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet isOpen={isOpen} onClose={onClose} detent="content" unstyled>
      <Sheet.Backdrop
        onTap={onClose}
        className="bg-background-main/55 backdrop-blur-[2px]"
      />
      <Sheet.Container className="pointer-events-none">
        <Sheet.Content
          disableDrag={false}
          className="bg-background-main border-border-main pointer-events-auto rounded-t-[16px] border-t"
        >
          {shareContent}
        </Sheet.Content>
      </Sheet.Container>
    </Sheet>
  );
}

function subscribeDesktopShareViewport(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia(
    `(min-width: ${MOBILE_VIEWPORT_BREAKPOINT_PX}px)`,
  );
  const handleChange = () => onStoreChange();

  mediaQuery.addEventListener("change", handleChange);

  return () => {
    mediaQuery.removeEventListener("change", handleChange);
  };
}

function getDesktopShareViewportSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia(`(min-width: ${MOBILE_VIEWPORT_BREAKPOINT_PX}px)`)
    .matches;
}

function getDesktopShareViewportServerSnapshot() {
  return false;
}
