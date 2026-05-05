import { cn } from "@/lib/utils";
import {
  Leaderboard1stBody,
  Leaderboard1stHead,
  Leaderboard2ndBody,
  Leaderboard2ndHead,
  LeaderboardBottom,
  LeaderboardDot,
} from "@/src/assets/icons";
import { formatCurrency } from "@/src/lib/utils";
import Image from "next/image";

export type LeaderboardTopUser = {
  rank: number;
  initials: string;
  username: string;
  volume: string;
  pnl: number;
  isHumanVerified: boolean;
};

const RankLabel = ({ label }: { label: string }) => {
  return (
    <div className="absolute bottom-[25%] left-1/2 z-99 -translate-x-1/2">
      <p
        className="bg-[linear-gradient(180deg,rgba(208,247,220,0.15)_13.49%,rgba(208,247,220,0.03)_86.51%)] bg-clip-text text-[48px] font-extrabold text-transparent"
        style={{
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {label}
      </p>
    </div>
  );
};

const PodiumUser = ({
  user,
  avatarClassName,
  infoClassName,
  nameClassName,
}: {
  user?: LeaderboardTopUser;
  avatarClassName?: string;
  infoClassName?: string;
  nameClassName?: string;
}) => {
  if (!user) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          "bg-primary-light text-background-main absolute top-[-38px] left-1/2 z-20 flex size-[86px] -translate-x-1/2 items-center justify-center rounded-full text-[44px] tracking-[-0.5px]",
          avatarClassName,
        )}
      >
        {user.initials}
        {user.isHumanVerified ? (
          <Image
            src="/onboarding/verified-badge.svg"
            alt="Verified human"
            width={28}
            height={28}
            className="absolute right-[-2px] bottom-[2px] h-7 w-7"
          />
        ) : null}
      </div>

      <div
        className={cn(
          "absolute top-[58px] left-1/2 z-20 w-[86%] -translate-x-1/2 text-center",
          infoClassName,
        )}
      >
        <p
          className={cn(
            "text-text-main truncate text-[34px] font-semibold tracking-[-0.14px]",
            nameClassName,
          )}
        >
          {user.username}
        </p>
        <p className="text-text-sub truncate text-[14px] tracking-[-0.14px]">
          {formatCurrency(user.pnl)}
        </p>
      </div>
    </>
  );
};

export const FirstRank = ({ user }: { user?: LeaderboardTopUser }) => {
  return (
    <div className="background-[transparent] relative z-10 w-fit">
      <RankLabel label="1st" />
      <PodiumUser
        user={user}
        nameClassName="text-[14px]"
        avatarClassName="top-[-34px] size-[60px] text-[30px]"
      />

      {/* Opaque mask to hide 2nd-rank lines behind the 1st podium body. */}
      <div
        aria-hidden
        className="bg-background-main absolute top-[40px] left-0 z-0 h-[215px] w-[161px]"
        style={{
          clipPath: "polygon(1.6% 0.5%, 98.4% 0.5%, 86.1% 99.5%, 13.9% 99.5%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[40px] left-0 z-10 h-[215px] w-[161px] bg-[linear-gradient(180deg,rgba(208,247,220,0.18)_0%,rgba(208,247,220,0.09)_30%,rgba(208,247,220,0.01)_100%)]"
        style={{
          clipPath: "polygon(1.6% 0.5%, 98.4% 0.5%, 86.1% 99.5%, 13.9% 99.5%)",
        }}
      />

      <div className="relative z-10">
        <LeaderboardDot className="absolute -top-8 left-1/2 z-99 w-[200px] -translate-x-1/2" />
        <Leaderboard1stHead className="brightness-115 saturate-110" />

        <Leaderboard1stBody className="relative z-20 brightness-[1.25] saturate-110" />
      </div>
    </div>
  );
};

export const RecondRank = ({
  className,
  infoClassName,
  avatarClassName,
  label,
  user,
  leaderboardSvgBodyClassName,
  isDimmed,
}: {
  className?: string;
  infoClassName?: string;
  avatarClassName?: string;
  label: string;
  user?: LeaderboardTopUser;
  leaderboardSvgBodyClassName?: string;
  isDimmed?: boolean;
}) => {
  return (
    <div
      className={cn(
        "relative top-[40px] left-8 w-fit",
        isDimmed && "opacity-70",
        className,
      )}
    >
      <RankLabel label={label} />
      <PodiumUser
        user={user}
        avatarClassName={cn(
          "top-[-34px] size-[50px] text-[30px]",
          avatarClassName,
        )}
        infoClassName={cn("top-[48px]", infoClassName)}
        nameClassName="text-[14px]"
      />
      <Leaderboard2ndHead />
      <Leaderboard2ndBody className={cn(leaderboardSvgBodyClassName)} />
    </div>
  );
};

const LeaderboardRank = ({ topUsers }: { topUsers: LeaderboardTopUser[] }) => {
  const secondUser = topUsers.find((user) => user.rank === 2);
  const firstUser = topUsers.find((user) => user.rank === 1);
  const thirdUser = topUsers.find((user) => user.rank === 3);

  return (
    <div className="relative mb-14">
      <div className="relative top-10 flex flex-row justify-center">
        <RecondRank
          label="2nd"
          user={secondUser}
          infoClassName="left-[40%] w-[64%]"
          avatarClassName="bg-[#56C5C5]"
          isDimmed
        />

        <FirstRank user={firstUser} />
        <RecondRank
          className="top-[60px] -left-8"
          leaderboardSvgBodyClassName="rotate-y-[-180deg]"
          label="3rd"
          user={thirdUser}
          infoClassName="left-[60%]"
          avatarClassName="bg-[#5A8FE5] left-[50%]"
          isDimmed
        />
      </div>

      <LeaderboardBottom className="absolute -bottom-14 z-20 w-full scale-y-110" />
    </div>
  );
};

export default LeaderboardRank;
