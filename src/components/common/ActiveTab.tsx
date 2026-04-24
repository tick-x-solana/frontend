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

interface ActiveTabContainerProps {
  listTabs: readonly TabType[];
  activeTab: string;
  onTabChange: (value: TabType["value"]) => void | Promise<unknown>;
  className?: string;
}

const ActiveTabItem = ({
  label,
  value,
  isActive,
  onClick,
}: ActiveTabItemProps) => {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={() => onClick(value)}
      className={cn(
        "relative cursor-pointer overflow-hidden rounded-[8px] px-2 py-1.5 text-center text-base font-semibold",
        isActive
          ? "bg-background-surface/80 text-primary-medium after:bg-primary-medium after:absolute after:right-[19.64%] after:bottom-0 after:left-[19.64%] after:h-[3px] after:rounded-full after:content-['']"
          : "text-hint",
      )}
    >
      {label}
    </button>
  );
};

const ActiveTabContainer = ({
  listTabs,
  activeTab,
  onTabChange,
  className,
}: ActiveTabContainerProps) => {
  return (
    <div
      className={cn(
        "bg-surface-overlay-subtle flex w-max rounded-xl p-1",
        className,
      )}
    >
      {listTabs.map((tab) => {
        const isActive = activeTab === tab.value;
        return (
          <ActiveTabItem
            key={tab.value}
            isActive={isActive}
            onClick={onTabChange}
            {...tab}
          />
        );
      })}
    </div>
  );
};

const QuerySyncedActiveTab = ({
  listTabs,
  className,
}: Pick<ActiveTabProps, "listTabs" | "className">) => {
  const defaultTab = listTabs[0]?.value ?? "";
  const [queryTab, setQueryTab] = useQueryState(
    "tab",
    parseAsString.withDefault(defaultTab),
  );

  return (
    <ActiveTabContainer
      listTabs={listTabs}
      activeTab={queryTab}
      onTabChange={setQueryTab}
      className={className}
    />
  );
};

const ActiveTab = ({
  listTabs,
  activeTab: controlledActiveTab,
  onTabChange,
  className,
}: ActiveTabProps) => {
  if (controlledActiveTab !== undefined) {
    return (
      <ActiveTabContainer
        listTabs={listTabs}
        activeTab={controlledActiveTab}
        onTabChange={onTabChange ?? (() => undefined)}
        className={className}
      />
    );
  }

  return <QuerySyncedActiveTab listTabs={listTabs} className={className} />;
};

export default ActiveTab;
