import ActiveRef from "@/src/features/referrals/components/ActiveRef";
import HowItWork from "@/src/features/referrals/components/HowItWork";
import ReferAFriend from "@/src/features/referrals/components/ReferAFriend";
import ReferralsHeader from "@/src/features/referrals/components/ReferralsHeader";
import UserRefInfo from "@/src/features/referrals/components/UserRefInfo";
import Image from "next/image";

const Referrals = () => {
  return (
    <div className="bg-background-main relative flex-col gap-4 overflow-hidden px-4 py-4 md:gap-6 md:px-10 xl:gap-8 xl:px-20">
      <Image
        src="/line-background.svg"
        alt="tickx"
        width={100}
        height={100}
        className="pointer-events-none absolute top-[100px] z-0 h-full w-full object-cover opacity-50"
      />

      <ReferralsHeader />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="order-3 xl:order-1">
          <UserRefInfo />
        </div>
        <div className="order-1 xl:order-2">
          <ReferAFriend />
        </div>
        <div className="order-4 xl:order-3">
          <ActiveRef />
        </div>
        <div className="order-2 xl:order-4">
          <HowItWork />
        </div>
      </div>
    </div>
  );
};

export default Referrals;
