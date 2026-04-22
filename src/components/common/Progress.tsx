import { cn } from "@/lib/utils";

export interface ProgressPalette {
  track: string;
  fill: string;
  glowShadow: string;
  glowHighlight: string;
  glowHalo: string;
  thumb: string;
}

interface ProgressProps {
  value: number;
  className?: string;
  palette?: Partial<ProgressPalette>;
}

const DEFAULT_PROGRESS_PALETTE: ProgressPalette = {
  track: "rgba(255,255,255,0.12)",
  fill: "#96fea7",
  glowShadow: "#587994",
  glowHighlight: "#e2ffe2",
  glowHalo: "#96fea7",
  thumb: "#f3fff3",
};

const Progress = ({ value, className, palette }: ProgressProps) => {
  const boundedValue = Math.max(0, Math.min(1, value));
  const progressPercent = `${boundedValue * 100}%`;
  const resolvedPalette = { ...DEFAULT_PROGRESS_PALETTE, ...palette };

  return (
    <div
      className={cn("relative h-[6px] rounded-[8px]", className)}
      style={{ background: resolvedPalette.track }}
      role="progressbar"
      aria-label="Prediction progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(boundedValue * 100)}
    >
      <div
        className="h-full rounded-[8px]"
        style={{ width: progressPercent, background: resolvedPalette.fill }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-1/2 h-[6px] w-[4px] -translate-x-1/2 -translate-y-1/2 mix-blend-plus-lighter blur-[2px]"
        style={{
          left: `calc(${progressPercent} - 1px)`,
          background: resolvedPalette.glowShadow,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-1/2 h-[10px] w-[5px] -translate-x-1/2 -translate-y-1/2 mix-blend-plus-lighter blur-[2px]"
        style={{
          left: `calc(${progressPercent} + 0.5px)`,
          background: resolvedPalette.glowHighlight,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-1/2 h-[4px] w-3 -translate-x-1/2 -translate-y-1/2 mix-blend-plus-lighter blur-[4px]"
        style={{
          left: `calc(${progressPercent} - 5px)`,
          background: resolvedPalette.glowHalo,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-1/2 h-[6px] w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ left: progressPercent, background: resolvedPalette.thumb }}
        aria-hidden
      />
    </div>
  );
};

export const progressPalettes = {
  green: DEFAULT_PROGRESS_PALETTE,
  aurora: {
    track: "rgba(255,255,255,0.12)",
    fill: "linear-gradient(90deg, #c8ffe5 0%, #8db5d6 55%, #f6d166 100%)",
    glowShadow: "#6e94b5",
    glowHighlight: "#ffffff",
    glowHalo: "#ffd65c",
    thumb: "#ffffff",
  } satisfies ProgressPalette,
};

export default Progress;
