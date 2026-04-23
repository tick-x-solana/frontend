"use client";
import { cn } from "@/lib/utils";
import { parseAsString, useQueryState } from "nuqs";

type TabType = {
  label: string;
  value: string;
};

interface ActiveTabProps {
  listTabs: readonly TabType[];
  activeTab?: string;
  onTabChange?: (value: TabType["value"]) => void | Promise<unknown>;
  className?: string;
}

interface ActiveTabItemProps {
  label: string;
  value: string;
  isActive: boolean;
  onClick: (value: TabType["value"]) => void | Promise<unknown>;
}

const ActiveTabItem = ({
  label,
  value,
  isActive,
  onClick,
}: ActiveTabItemProps) => {
  return (
    <div
      onClick={() => onClick(value)}
      className={cn(
        "relative cursor-pointer overflow-hidden rounded-[8px] px-2 py-1.5 text-center text-base leading-6 font-semibold tracking-[-0.16px] text-white",
        isActive
          ? "text-primary-medium after:bg-primary-medium bg-[linear-gradient(90deg,rgba(13,30,48,0.8)_0%,rgba(13,30,48,0.8)_100%),linear-gradient(90deg,#A8E8BB_0%,#A8E8BB_100%)] after:absolute after:right-[19.64%] after:bottom-0 after:left-[19.64%] after:h-[3px] after:rounded-full after:content-['']"
          : "text-hint",
      )}
    >
      {label}
    </div>
  );
};

const ActiveTab = ({
  listTabs,
  activeTab: controlledActiveTab,
  onTabChange,
  className,
}: ActiveTabProps) => {
  const defaultTab = listTabs[0]?.value ?? "";
  const [queryTab, setQueryTab] = useQueryState(
    "tab",
    parseAsString.withDefault(defaultTab),
  );
  const activeTab = controlledActiveTab ?? queryTab;
  const handleTabChange = onTabChange ?? setQueryTab;

  return (
    <div
      className={cn(
        "flex w-max rounded-xl bg-[rgba(255,255,255,0.04)] p-1",
        className,
      )}
    >
      {listTabs.map((tab) => {
        const isActive = activeTab === tab.value;
        return (
          <ActiveTabItem
            key={tab.value}
            isActive={isActive}
            onClick={handleTabChange}
            {...tab}
          />
        );
      })}
    </div>
  );
};

export default ActiveTab;
