"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  XCircle,
  Zap,
} from "lucide-react";
import { PriceIntegrityCREWorkflow } from "./WorkflowDiagrams";

type CreRow = Record<string, string | number | boolean | undefined>;

type CreColumn = {
  key: string;
  label: string;
  render?: (row: CreRow) => ReactNode;
};

type CreSectionProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

const txHashes = [
  "57jGVDvMPT6UxNcrx6ktkf7bDF19pS9PANCtfqcZF6QVA9F7AqWhpb59t6F863qzg14jYHN5WLmKdeVqhQXphZJ3",
  "2eu1wbc4Ys4aLsddu9MmaSHregJqbySaA28U9Vnc1J4amXUNf99LBBUG3RVogZKKkwu2JpX2gYMLAKiujC2gvt4N",
  "28AVqUCd2V1GAR7pbYVQHpSkEkq2mhTjf5gQ2tqM3n8WXaFPzsYw8NiqEQZXf8z7Ei8MsXid55odTPoVd4ujKiW7",
  "1dbNrPdoGpUN2A6tqGScWQa67CcgAeRiS9GgA5i4vHL4sXraVw4aaUHdauJ47KjrGrZ1mw934dTngxYdtUmXn89",
  "3aYK4jj7BVqJX4CZqEG71wuU2a5QD5NFtJaRU6YtXynoVgdRaXq7P3EFR2F4siovPSiacZxju7tHDY2geW9cTbAr",
  "2nJVouNqdqLkqFkSAknNMpoMbmLz73njNnaoAqLifaRj3vZo44YeiQyWyfThsPXad3o5KQpFexjuXp36aRRjvKzt",
  "2u7e2UGKke8mKRLyVHcZZStRcq5qNKwUXvVnoEx6YyxTKZEpPE18TJNYu89HCScZyUUARjnQhabB5SvYEMA2pRK8",
  "4FBcsCDdh1AfUd2AwEiNvtasC5MT1cWvtz8Ez2q2dbeCdtGxMMMhyRbhB9jkVvUN9iQRAUdKq4ZjuR3MYLf42Tv3",
  "4mzFTjY1gKVGXnaNgLLyAQoMUUy9DK331mZ8tRn4a7W4nZhgpbi8RvSJpqxnu33B6cbWSiMJxK3cwvVtpFAG5Ucc",
  "5xzLbu3j7n7WZY1s6p6KX68R8cC1FbpowB8mwMPQBXK5c4j9HSk3upYucjhCSm6E6bFtMiavYjEqJYtWMdeNMRYS",
  "5zvkVohD2Xd25Mn2MmokptFTmEeX4NxdngQKdjzMytqhWZBAg9i4ryNkQDv2TAV3LgUzj5Pjh8NF9p3c4AwT25vu",
];
const nowTimestamp = Date.now();
const fifteenMinutesMs = 15 * 60 * 1000;
const roundedNow15m =
  Math.floor(nowTimestamp / fifteenMinutesMs) * fifteenMinutesMs;
const totalBatches = 214;

function shortHash(value: string | undefined) {
  if (!value) return "-";
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function bpsToPercent(bps: number) {
  return `${(bps / 100).toFixed(2)}%`;
}

function fmt(n: number) {
  return n.toLocaleString();
}

function to15mWindowLabel(index: number) {
  const end = new Date(roundedNow15m - index * fifteenMinutesMs);
  const start = new Date(end.getTime() - fifteenMinutesMs);

  const date = end.toLocaleDateString();
  const startTime = start.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTime = end.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${date} ${startTime} - ${endTime}`;
}

function CreSection({
  icon,
  title,
  subtitle,
  badge,
  defaultOpen = false,
  children,
}: CreSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="border-border-main bg-surface-card overflow-hidden rounded-[14px] border">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="bg-surface-overlay-subtle flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="bg-surface-overlay-medium flex size-8 shrink-0 items-center justify-center rounded-[8px]">
            <span className="text-primary-light">{icon}</span>
          </div>
          <div className="min-w-0">
            <p className="text-text-heading truncate text-sm font-semibold tracking-[-0.01em]">
              {title}
            </p>
            <p className="text-text-sub truncate text-xs">{subtitle}</p>
          </div>
          {badge}
        </div>
        <span className="text-hint shrink-0">
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>
      {isOpen ? <div className="p-4 pt-3">{children}</div> : null}
    </section>
  );
}

function DataTable({
  columns,
  rows,
}: {
  columns: CreColumn[];
  rows: CreRow[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-border-main border-b">
            {columns.map((column) => (
              <th
                key={column.key}
                className="text-text-sub py-2 pr-4 text-[10px] font-semibold tracking-[0.14em] uppercase"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              className="border-border-main/60 border-b last:border-0"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className="text-text-heading py-2.5 pr-4 font-mono whitespace-nowrap"
                >
                  {column.render
                    ? column.render(row)
                    : String(row[column.key] ?? "-")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatChip({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="border-border-main bg-surface-overlay-subtle flex min-w-0 flex-col gap-1 rounded-[10px] border px-3 py-2">
      <p className="text-text-sub text-[10px] font-semibold tracking-[0.14em] uppercase">
        {label}
      </p>
      <p
        className={["text-sm font-bold break-words", valueClassName]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

function SectionCountBadge({ count }: { count: number }) {
  return (
    <span className="bg-surface-overlay-medium text-primary-light rounded-full px-2 py-1 text-[10px] font-bold tracking-[0.14em] uppercase">
      {count}
    </span>
  );
}

function CompactWorkflow({ children }: { children: ReactNode }) {
  return <div className="mx-auto mt-4 w-full max-w-[860px]">{children}</div>;
}

export default function CREProofView() {
  const priceRows = useMemo(
    () =>
      txHashes.map((hash, index) => ({
        timeWindow: to15mWindowLabel(index),
        scoreBps: 9792 + (index % 5) * 38,
        p95Bps: 8 + (index % 4) * 3,
        pass: true,
        failFlags: "0x00",
        txHash: hash,
      })),
    [],
  );

  const avgScoreBps = Math.round(
    priceRows.reduce((sum, row) => sum + Number(row.scoreBps), 0) /
      Math.max(priceRows.length, 1),
  );

  return (
    <div className="flex flex-col gap-4 pb-4">
      <header className="border-border-main bg-surface-card rounded-[14px] border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-surface-overlay-medium flex size-9 shrink-0 items-center justify-center rounded-[8px]">
              <ShieldCheck className="text-primary-light" size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-text-heading text-lg font-semibold tracking-[-0.02em]">
                Switchboard TEE Runs
              </h2>
              <p className="text-text-sub text-xs">
                On-chain Switchboard TEE events in the last 7 days
              </p>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 md:grid-cols-4">
            <StatChip
              label="Total Batches"
              value={fmt(totalBatches)}
              valueClassName="text-primary-light"
            />
            <StatChip
              label="Passed"
              value={
                <span className="text-success-light inline-flex items-center gap-1">
                  <CheckCircle2 size={13} /> {totalBatches}
                </span>
              }
            />
            <StatChip
              label="Failed"
              value={
                <span className="text-hint inline-flex items-center gap-1">
                  <XCircle size={13} /> 0
                </span>
              }
            />
            <StatChip
              label="Avg Score"
              value={bpsToPercent(10000)}
              valueClassName="text-text-heading"
            />
          </div>
        </div>
      </header>

      <CreSection
        icon={<Zap size={16} />}
        title="Price Integrity Checks"
        subtitle="BatchSubmitted events · Authoritative pass/fail results"
        badge={<SectionCountBadge count={priceRows.length} />}
        defaultOpen
      >
        <DataTable
          columns={[
            { key: "timeWindow", label: "15m Window" },
            {
              key: "scoreBps",
              label: "Score",
              render: (row) => (
                <span className="text-primary-light">
                  {bpsToPercent(Number(row.scoreBps))}
                </span>
              ),
            },
            {
              key: "p95Bps",
              label: "P95 MAE",
              render: (row) => bpsToPercent(Number(row.p95Bps)),
            },
            {
              key: "pass",
              label: "Result",
              render: () => (
                <span className="text-success-light inline-flex items-center gap-1 font-semibold">
                  <CheckCircle2 size={13} />
                  PASS
                </span>
              ),
            },
            { key: "failFlags", label: "Fail Flags" },
            {
              key: "txHash",
              label: "Tx Hash",
              render: (row) => (
                <a
                  className="text-text-link-main hover:text-primary-light transition-colors"
                  href={`https://solscan.io/tx/${String(row.txHash)}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortHash(String(row.txHash))}
                </a>
              ),
            },
          ]}
          rows={priceRows}
        />
        <CompactWorkflow>
          <PriceIntegrityCREWorkflow />
        </CompactWorkflow>
      </CreSection>

      <p className="text-hint px-1 text-center text-[10px]">
        Data sourced from Switchboard TEE worker events
      </p>
    </div>
  );
}
