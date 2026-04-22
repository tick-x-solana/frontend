import { cn } from "@/lib/utils";

interface OverviewCardProps {
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
  valueColor?: string;
}

const OverviewCard = ({
  label,
  value,
  className,
  valueClassName,
  valueColor,
}: OverviewCardProps) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 overflow-hidden rounded-[8px] border border-[#1e3550] bg-background-main px-[10px] py-[10px] text-center",
        className,
      )}
    >
      <p className="text-hint text-base leading-6 font-medium tracking-[-0.01em]">
        {label}
      </p>
      <p
        className={cn(
          "text-[20px] leading-7 font-semibold tracking-[-0.01em] text-white",
          valueClassName,
        )}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </p>
    </div>
  );
};

export default OverviewCard;
