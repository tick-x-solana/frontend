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
        "border-border-main bg-background-surface flex flex-col gap-1 overflow-hidden rounded-[10px] border px-3 py-3",
        className,
      )}
    >
      <p className="text-hint text-[10px] font-medium tracking-[0.03em] uppercase">
        {label}
      </p>
      <p
        className={cn(
          "text-[18px] font-bold tracking-[-0.02em] text-white",
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
