import BetInfo from "@/src/features/trade/components/BetInfo";
import { TradingGrid } from "@/src/features/trade/components/TradingGrid";

type HomePageProps = PageProps<"/">;

function tryDecodePathParam(path: string) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function decodePathParamDeep(path: string) {
  let current = path;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const decoded = tryDecodePathParam(current);
    if (decoded === current) {
      break;
    }
    current = decoded;
  }
  return current;
}

function extractRefCodeFromMiniAppPath(pathParam: string) {
  const normalizedPath = decodePathParamDeep(pathParam).trim();
  const referralRouteMatch = normalizedPath.match(
    /^\/?ref\/([^/?#]+)(?:\?.*)?$/i,
  );
  if (referralRouteMatch?.[1]) {
    return referralRouteMatch[1].trim();
  }

  const draftRouteMatch = normalizedPath.match(
    /^\/?([^/?#]+)\/draft(?:\?.*)?$/i,
  );
  return draftRouteMatch?.[1]?.trim() || null;
}

function readSingleSearchParam(
  value: string | string[] | undefined,
): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === "string") {
      const trimmed = first.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
  }
  return null;
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const rawPath = readSingleSearchParam(params.path);
  const followRefCode = readSingleSearchParam(params.followRef);
  const refCodeFromPath = rawPath ? extractRefCodeFromMiniAppPath(rawPath) : null;
  const initialFollowRefCode = followRefCode ?? refCodeFromPath;

  return (
    <div className="bg-background-main flex h-full flex-1 flex-col">
      <div className="flex max-h-[calc(100dvh-72px)] min-h-[calc(100dvh-72px)] flex-1">
        <div className="hidden md:block">
          <BetInfo />
        </div>

        <TradingGrid initialFollowRefCode={initialFollowRefCode} />
      </div>
    </div>
  );
}
