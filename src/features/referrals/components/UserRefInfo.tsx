import { BoltIcon, ShieldCheckIcon } from "@/src/assets/icons";
import Progress, { progressPalettes } from "@/src/components/common/Progress";
import Image from "next/image";

const CURRENT_REFERRALS = 12;
const NEXT_RANK_REFERRALS = 15;
const USER_INITIALS = "PL";
const USER_NAME = "TickX Finance";
const JOINED_AT = "Joined on 24 November 2026";
const CURRENT_RANK = "Silver";
const REFERRAL_CARDS = [
  {
    title: "Incentive",
    value: "$402.52",
    rows: [
      { label: "Next payout", value: "$25.25" },
      { label: "Paid", value: "$385.22" },
    ],
  },
  {
    title: "Total referrals",
    value: "12",
    rows: [
      { label: "Unique invite", value: "12" },
      { label: "Invite this month", value: "4" },
    ],
  },
] as const;

const UserRefOverView = () => {
  const remainingReferrals = Math.max(
    0,
    NEXT_RANK_REFERRALS - CURRENT_REFERRALS,
  );
  const progressValue = CURRENT_REFERRALS / NEXT_RANK_REFERRALS;

  return (
    <section className="border-border-main bg-surface-card flex flex-col gap-4 rounded-[14px] border p-4 shadow-[0_16px_32px_rgba(0,0,0,0.16)]">
      <div className="flex items-center gap-4">
        <div className="bg-primary-light text-text-inverse flex size-[56px] shrink-0 items-center justify-center rounded-full font-mono text-[26px] font-semibold tracking-[-0.03em]">
          {USER_INITIALS}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-text-heading text-[28px] font-semibold tracking-[-0.03em]">
              {USER_NAME}
            </h3>
            <div className="bg-success-background border-success-border flex items-center gap-1 rounded-full border px-2 py-1">
              <ShieldCheckIcon
                className="text-success-medium size-4"
                aria-hidden="true"
              />
              <span className="text-success-medium font-mono text-xs font-bold">
                Verified
              </span>
            </div>
          </div>
          <p className="text-text-sub mt-1 text-sm font-medium tracking-[-0.01em]">
            {JOINED_AT}
          </p>
        </div>
      </div>

      <div className="bg-border-main h-px w-full" />

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-text-sub font-medium">Current rank:</span>
            <span className="text-text-main font-mono font-bold">
              {CURRENT_RANK}
            </span>
          </div>
          <p className="text-text-sub font-medium">
            Next:{" "}
            <span className="text-text-main">
              {remainingReferrals} referrals ({CURRENT_REFERRALS}/
              {NEXT_RANK_REFERRALS})
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Image
            src="/icons/medal_1.png"
            alt="bronze-medal-image"
            width={24}
            height={24}
          />
          <Progress
            value={progressValue}
            className="w-full"
            palette={progressPalettes.aurora}
          />
          <Image
            src="/icons/medal_2.png"
            alt="gold-medal-image"
            width={24}
            height={24}
          />
        </div>
      </div>
    </section>
  );
};

const UserRefCard = () => {
  return (
    <section className="grid gap-3">
      {REFERRAL_CARDS.map((card) => (
        <article
          key={card.title}
          className="border-border-main overflow-hidden rounded-[14px] border shadow-[0_16px_32px_rgba(0,0,0,0.16)]"
        >
          <div className="bg-surface-overlay-subtle border-border-main flex items-center gap-4 border-b p-4">
            <div className="bg-primary-medium/16 flex size-9 shrink-0 items-center justify-center rounded-[10px]">
              <BoltIcon
                className="text-primary-medium size-5"
                aria-hidden="true"
              />
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
              <p className="text-text-sub text-sm font-normal tracking-[-0.01em]">
                {card.title}
              </p>
              <p className="text-text-heading font-semibold tracking-[-0.03em]">
                {card.value}
              </p>
            </div>
          </div>

          <div className="bg-surface-card p-4">
            {card.rows.map((row, index) => (
              <div key={row.label}>
                <div className="flex items-center justify-between gap-4 py-1">
                  <p className="text-text-sub text-sm font-semibold tracking-[-0.01em]">
                    {row.label}
                  </p>
                  <p className="text-text-heading text-sm font-bold">
                    {row.value}
                  </p>
                </div>
                {index < card.rows.length - 1 && (
                  <div className="bg-border-main my-2 h-px w-full" />
                )}
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
};

const UserRefInfo = () => {
  return (
    <div className="column w-full gap-3">
      <UserRefOverView />
      <UserRefCard />
    </div>
  );
};

export default UserRefInfo;
