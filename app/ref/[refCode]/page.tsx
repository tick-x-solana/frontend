import ReferralCopyTradingPage from "@/src/features/referrals/components/ReferralCopyTradingPage";

type RefPageProps = PageProps<"/ref/[refCode]">;

export default async function RefPage({ params }: RefPageProps) {
  const { refCode } = await params;

  return <ReferralCopyTradingPage refCode={refCode} />;
}
