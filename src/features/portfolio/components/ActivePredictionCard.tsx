import { Clock3, Zap } from "lucide-react";
import Progress, {
  type ProgressPalette,
  progressPalettes,
} from "@/src/components/common/Progress";
import { cn } from "@/lib/utils";

interface ActivePredictionCardProps {
  pair?: string;
  placedAt?: string;
  expectedIn?: string;
  multiplier?: string;
  status?: string;
  currentPrice?: string;
  targetPrice?: string;
  progress?: number;
  progressPalette?: Partial<ProgressPalette>;
  progressVariant?: keyof typeof progressPalettes;
  className?: string;
}

const ActivePredictionCard = ({
  pair = "--",
  placedAt = "--",
  expectedIn = "--",
  multiplier = "--",
  status = "--",
  currentPrice = "--",
  targetPrice = "--",
  progress = 0,
  progressPalette,
  progressVariant = "green",
  className,
}: ActivePredictionCardProps) => {
  const resolvedProgressPalette = {
    ...progressPalettes[progressVariant],
    ...progressPalette,
  };

  return (
    <div
      className={cn(
        "w-full rounded-[8px] border border-[#1e3550] bg-[#0d1e30] p-6",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-[8px] bg-[linear-gradient(90deg,rgba(21,21,21,0.85)_0%,rgba(21,21,21,0.85)_100%),linear-gradient(90deg,#A8E8BB_0%,#A8E8BB_100%)]">
              <Zap size={18} className="text-[#a8e8bb]" strokeWidth={2} />
            </div>
            <p className="text-[18px] leading-[27px] font-semibold tracking-[-0.01em] text-[#e8f4ff]">
              {pair}
            </p>
            <span className="rounded-[6px] bg-[rgba(255,255,255,0.12)] px-1.5 py-[3px] text-[12px] leading-4 font-semibold tracking-[-0.01em] text-[#7a9bb5] uppercase">
              {placedAt}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Clock3 size={18} className="text-[#7a9bb5]" strokeWidth={1.8} />
            <p className="text-[14px] leading-5 font-medium tracking-[-0.01em] text-[#7a9bb5]">
              Expected to win in:
            </p>
            <p className="text-[14px] leading-5 font-medium tracking-[-0.01em] text-[#7fd89a]">
              {expectedIn}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[20px] leading-7 font-semibold tracking-[-0.01em] text-[#a8e8bb]">
            {multiplier}
          </p>
          <p className="text-[14px] leading-5 font-normal tracking-[-0.01em] text-[#7a9bb5]">
            {status}
          </p>
        </div>
      </div>

      <div className="my-4 border-t border-[#1e3550]" />

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[14px] leading-6 font-medium tracking-[-0.01em] text-[#7a9bb5]">
            Current:{" "}
            <span className="font-mono text-[14px] leading-4 font-bold text-[#e8f4ff]">
              {currentPrice}
            </span>
          </p>
          <p className="text-[14px] leading-6 font-medium tracking-[-0.01em] text-[#7a9bb5]">
            Target Price:{" "}
            <span className="font-mono text-[14px] leading-4 font-bold text-[#e8f4ff]">
              {targetPrice}
            </span>
          </p>
        </div>

        <Progress value={progress} palette={resolvedProgressPalette} />
      </div>
    </div>
  );
};

export default ActivePredictionCard;
