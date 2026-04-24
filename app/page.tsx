import { redirect } from "next/navigation";
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
  const referralRouteMatch = normalizedPath.match(/^\/?ref\/([^/?#]+)(?:\?.*)?$/i);
  if (referralRouteMatch?.[1]) {
    return referralRouteMatch[1].trim();
  }

  const draftRouteMatch = normalizedPath.match(/^\/?([^/?#]+)\/draft(?:\?.*)?$/i);
  return draftRouteMatch?.[1]?.trim() || null;
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const rawPath =
    typeof params.path === "string"
      ? params.path
      : Array.isArray(params.path)
        ? params.path[0]
        : undefined;

  if (rawPath) {
    const refCode = extractRefCodeFromMiniAppPath(rawPath);
    if (refCode) {
      redirect(`/ref/${encodeURIComponent(refCode)}`);
    }
  }

  return (
    <div className="bg-background-main flex h-full flex-1 flex-col">
      <div className="flex max-h-[calc(100vh-72px)] min-h-[calc(100vh-72px)] flex-1">
        <div className="hidden md:block">
          <BetInfo />
        </div>

        <TradingGrid />
      </div>
    </div>
  );
}
