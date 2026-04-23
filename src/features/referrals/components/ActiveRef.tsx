type ReferralRow = {
  id: string;
  dateReferred: string;
  status: "Active" | "Inactive";
  rate: string;
  commission: string;
};

const ACTIVE_REFERRALS: ReferralRow[] = [
  {
    id: "1224",
    dateReferred: "24/04/2026",
    status: "Active",
    rate: "1.8%",
    commission: "$25.00",
  },
  {
    id: "1222",
    dateReferred: "22/04/2026",
    status: "Active",
    rate: "2.5%",
    commission: "$30.00",
  },
  {
    id: "1223",
    dateReferred: "23/04/2026",
    status: "Inactive",
    rate: "3.0%",
    commission: "$45.00",
  },
  {
    id: "1225",
    dateReferred: "25/04/2026",
    status: "Active",
    rate: "2.2%",
    commission: "$35.00",
  },
];

const StatusChip = ({ status }: Pick<ReferralRow, "status">) => {
  const isActive = status === "Active";

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-semibold tracking-[-0.01em] uppercase",
        isActive
          ? "bg-surface-card text-success-medium"
          : "bg-surface-overlay-subtle text-hint",
      ].join(" ")}
    >
      <span
        className={[
          "size-1.5 rounded-full",
          isActive ? "bg-success-medium" : "bg-hint",
        ].join(" ")}
        aria-hidden="true"
      />
      {status}
    </span>
  );
};

const ActiveRef = () => {
  return (
    <div className="column w-full gap-3">
      <h3 className="text-text-heading text-[22px] font-semibold tracking-[-0.02em]">
        My Current Active Referrals
      </h3>

      <section className="flex flex-col gap-3">
        {ACTIVE_REFERRALS.map((referral) => (
          <article
            key={referral.id}
            className="border-border-main bg-background-main rounded-lg border px-2.5 py-2.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-text-heading text-base font-semibold tracking-[-0.01em]">
                    #{referral.id}
                  </p>
                  <span className="text-text-sub text-xs font-semibold tracking-[-0.01em]">
                    ·
                  </span>
                  <span className="text-text-sub text-xs font-semibold tracking-[-0.01em]">
                    {referral.dateReferred}
                  </span>
                </div>
              </div>
              <StatusChip status={referral.status} />
            </div>

            <div className="border-border-main mt-2.5 border-t pt-2.5">
              <div className="flex items-center gap-2 text-sm tracking-[-0.01em]">
                <p className="text-text-sub font-medium">Rate</p>
                <p className="text-text-heading font-bold">{referral.rate}</p>
                <div className="ml-auto flex items-center gap-2">
                  <p className="text-text-sub font-medium">Commission</p>
                  <p className="text-text-heading font-bold">
                    {referral.commission}
                  </p>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
};

export default ActiveRef;
