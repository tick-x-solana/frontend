import { Suspense } from "react";
import LeaderboardPage from "@/src/features/leaderboard/Leaderboard";

const Page = () => (
  <Suspense>
    <LeaderboardPage />
  </Suspense>
);

export default Page;
