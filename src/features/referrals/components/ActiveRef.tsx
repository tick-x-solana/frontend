import Title from "@/src/components/common/Title";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/shadcn/table";

type ReferralRow = {
  id: string;
  dateReferred: string;
  status: "Active" | "Inactive";
  rate: string;
  commission: string;
};

const ACTIVE_REFERRALS: ReferralRow[] = [
  {
    id: "1222",
    dateReferred: "22/04/2026",
    status: "Active",
    rate: "2.5%",
    commission: "$25.00",
  },
  {
    id: "1223",
    dateReferred: "23/04/2026",
    status: "Inactive",
    rate: "3.0%",
    commission: "$30.00",
  },
  {
    id: "1224",
    dateReferred: "24/04/2026",
    status: "Active",
    rate: "2.0%",
    commission: "$20.00",
  },
];

const StatusChip = ({ status }: Pick<ReferralRow, "status">) => {
  const isActive = status === "Active";

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm",
        isActive
          ? "bg-success-background text-success-medium"
          : "bg-surface-overlay-strong text-hint",
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
    <div className="column w-full gap-4">
      <Title>My Current Active Referrals</Title>

      <section className="border-border-main overflow-hidden rounded-lg border">
        <Table className="table-fixed">
          <TableHeader className="bg-surface-overlay-subtle">
            <TableRow className="border-border-main hover:bg-transparent">
              <TableHead className="text-text-sub h-auto w-1/4 p-4 text-sm font-normal md:w-1/5">
                ID
              </TableHead>
              <TableHead className="text-text-sub h-auto w-1/4 p-4 text-sm font-normal md:w-1/5">
                Date referred
              </TableHead>
              <TableHead className="text-text-sub h-auto w-1/4 p-4 text-sm font-normal md:w-1/5">
                Status
              </TableHead>
              <TableHead className="text-text-sub h-auto w-1/4 p-4 text-sm font-normal md:w-1/5">
                Rate
              </TableHead>
              <TableHead className="text-text-sub hidden h-auto w-1/5 p-4 text-sm font-normal md:table-cell">
                Commission
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody className="bg-background-main">
            {ACTIVE_REFERRALS.map((referral) => (
              <TableRow
                key={referral.id}
                className="border-0 hover:bg-transparent data-[state=selected]:bg-transparent"
              >
                <TableCell className="text-text-main p-4 text-sm">
                  {referral.id}
                </TableCell>
                <TableCell className="text-text-main p-4 text-sm">
                  {referral.dateReferred}
                </TableCell>
                <TableCell className="p-4 text-sm">
                  <StatusChip status={referral.status} />
                </TableCell>
                <TableCell className="text-text-sub p-4 text-sm">
                  {referral.rate}
                </TableCell>
                <TableCell className="text-text-sub hidden p-4 text-sm md:table-cell">
                  {referral.commission}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
};

export default ActiveRef;
