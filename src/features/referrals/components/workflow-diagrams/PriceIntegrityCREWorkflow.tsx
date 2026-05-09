import Image from "next/image";
import { Architects_Daughter } from "next/font/google";
import React from "react";

const architectsDaughter = Architects_Daughter({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const CANVAS_WIDTH = 1613;
const CANVAS_HEIGHT = 947;
const LINE_COLOR = "#d9dee7";
const FLOW_COLOR = "#9fffe3";
const FLOW_ARROW_DELAYS_SECONDS = [0];
const FLOW_DOT_RADIUS = 4.6;

type DiagramBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PositionedProps = {
  className?: string;
  children: React.ReactNode;
};

function toPercent(value: number, total: number) {
  return `${(value / total) * 100}%`;
}

function boxStyle(box: DiagramBox): React.CSSProperties {
  return {
    left: toPercent(box.x, CANVAS_WIDTH),
    top: toPercent(box.y, CANVAS_HEIGHT),
    width: toPercent(box.width, CANVAS_WIDTH),
    height: toPercent(box.height, CANVAS_HEIGHT),
  };
}

function pointStyle(x: number, y: number): React.CSSProperties {
  return {
    left: toPercent(x, CANVAS_WIDTH),
    top: toPercent(y, CANVAS_HEIGHT),
  };
}

function FlowPath({
  d,
  durationSeconds = 2.4,
  delaySeconds = 0,
}: {
  d: string;
  durationSeconds?: number;
  delaySeconds?: number;
}) {
  return (
    <>
      <path
        d={d}
        fill="none"
        markerEnd="url(#price-integrity-arrowhead)"
        stroke={LINE_COLOR}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
      {FLOW_ARROW_DELAYS_SECONDS.map((offsetSeconds) => {
        const beginSeconds = delaySeconds + offsetSeconds;

        return (
          <g
            key={`${d}-${beginSeconds}`}
            filter="url(#price-integrity-flow-glow)"
          >
            <circle
              cx="0"
              cy="0"
              r={FLOW_DOT_RADIUS}
              fill={FLOW_COLOR}
              opacity="0.95"
            />
            <animateMotion
              begin={`${beginSeconds}s`}
              calcMode="paced"
              dur={`${durationSeconds}s`}
              path={d}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              begin={`${beginSeconds}s`}
              dur={`${durationSeconds}s`}
              keyTimes="0;0.08;0.82;1"
              repeatCount="indefinite"
              values="0;1;1;0"
            />
          </g>
        );
      })}
    </>
  );
}

function TextLabel({
  children,
  x,
  y,
  className,
}: PositionedProps & { x: number; y: number }) {
  return (
    <p
      className={[
        "text-text-main absolute z-50 text-[7px] font-semibold whitespace-nowrap min-[520px]:text-[9px] min-[760px]:text-[12px]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={pointStyle(x, y)}
    >
      {children}
    </p>
  );
}

export const PriceIntegrityCREWorkflow: React.FC = () => {
  return (
    <div
      className={`${architectsDaughter.className} bg-background-main mx-auto w-full max-w-[980px] overflow-x-auto overflow-y-hidden rounded-[14px] border border-white/5 p-2`}
    >
      <div
        className="relative aspect-[1613/947] min-w-[760px] overflow-hidden rounded-[12px] border border-white/10 md:min-w-0"
        style={{
          background:
            "radial-gradient(ellipse at 30% 40%, rgba(109,40,217,0.13) 0%, transparent 55%), radial-gradient(ellipse at 75% 20%, rgba(37,99,235,0.10) 0%, transparent 50%), #07091a",
        }}
      >
        {/* Binance/Chainlink — pink/magenta */}
        <div
          className="absolute z-10 rounded-[12px] border-[1.5px] px-[2.3%] py-[2.7%]"
          style={{
            ...boxStyle({ x: 12, y: 34, width: 294, height: 204 }),
            borderColor: "#f472b6",
            background: "rgba(244,114,182,0.10)",
          }}
        >
          <p
            className="mt-[-10px] text-[7px] font-semibold text-[#f9a8d4] min-[520px]:text-[10px] min-[760px]:text-[13px]"
            style={{ lineHeight: 1.35 }}
          >
            Binance/Chainlink
            <br />
            Data Feeds
          </p>
          <div className="mx-auto flex w-[22px] items-center justify-center bg-white min-[520px]:w-[30px] min-[760px]:w-[40px]">
            <Image
              src="/chainlink.png"
              alt="Chainlink"
              width={180}
              height={80}
              className="h-auto w-full object-contain"
            />
          </div>
        </div>

        {/* TickX price API — teal/cyan */}
        <div
          className="absolute z-10 rounded-[12px] border-[1.5px] px-[2.3%] py-[2.9%]"
          style={{
            ...boxStyle({ x: 11, y: 278, width: 297, height: 205 }),
            borderColor: "#2dd4bf",
            background: "rgba(45,212,191,0.09)",
          }}
        >
          <p className="text-[7px] font-semibold text-[#5eead4] min-[520px]:text-[10px] min-[760px]:text-[13px]">
            TickX price API
          </p>
          <div className="mx-auto mt-3 w-[20px] min-[520px]:w-[28px] min-[760px]:w-[38px]">
            <Image
              src="/tickX.png"
              alt="TickX"
              width={80}
              height={80}
              className="h-auto w-full object-contain"
            />
          </div>
        </div>

        {/* Switchboard TEE frame — violet */}
        <div
          className="absolute z-10 rounded-[12px] border-[1.5px] px-[2%] py-[2.6%]"
          style={{
            ...boxStyle({ x: 440, y: 12, width: 603, height: 923 }),
            borderColor: "#a78bfa",
            background: "rgba(109,40,217,0.08)",
          }}
        >
          <p className="text-[7px] font-semibold text-[#c4b5fd] min-[520px]:text-[10px] min-[760px]:text-[13px]">
            Switchboard TEE
          </p>
          <div className="absolute top-[1.7%] right-[7.2%]">
            <Image
              src="/switchboard.png"
              alt="Switchboard"
              width={156}
              height={54}
              className="h-auto w-[28px] min-[520px]:w-[42px] min-[760px]:w-[58px]"
            />
          </div>
        </div>

        {/* HTTP Tasks — blue */}
        <div
          className="absolute z-20 flex items-center justify-center rounded-[12px] border-[1.5px] px-2 text-center text-[7px] font-semibold whitespace-nowrap text-[#93c5fd] min-[520px]:text-[9px] min-[760px]:text-[11px]"
          style={{
            ...boxStyle({ x: 628, y: 93, width: 209, height: 97 }),
            borderColor: "#3b82f6",
            background: "rgba(37,99,235,0.18)",
          }}
        >
          HTTP Task
        </div>
        <div
          className="absolute z-20 flex items-center justify-center rounded-[12px] border-[1.5px] px-2 text-center text-[7px] font-semibold whitespace-nowrap text-[#93c5fd] min-[520px]:text-[9px] min-[760px]:text-[11px]"
          style={{
            ...boxStyle({ x: 632, y: 242, width: 209, height: 98 }),
            borderColor: "#3b82f6",
            background: "rgba(37,99,235,0.18)",
          }}
        >
          HTTP Task
        </div>

        {/* Comparison Task — emerald/green */}
        <div
          className="absolute z-20 flex items-center justify-center rounded-[12px] border-[1.5px] px-2 text-center text-[7px] font-semibold whitespace-nowrap text-[#6ee7b7] min-[520px]:text-[9px] min-[760px]:text-[11px]"
          style={{
            ...boxStyle({ x: 634, y: 403, width: 209, height: 98 }),
            borderColor: "#10b981",
            background: "rgba(5,150,105,0.18)",
          }}
        >
          Comparision Task
        </div>

        {/* 6 Switchboard feeds — purple */}
        <div
          className="absolute z-20 rounded-[12px] border-[1.5px] border-[#9a7bff] bg-[rgba(107,86,168,0.78)] px-[1.5%] py-[1.8%] text-[5px] font-semibold whitespace-nowrap text-[#efe8ff] min-[520px]:text-[7px] min-[760px]:text-[9px]"
          style={{
            ...boxStyle({ x: 631, y: 581, width: 226, height: 234 }),
            lineHeight: 1.38,
          }}
        >
          <p>6 Switchboard feeds</p>
          <p>1 ohlc_mae_bps</p>
          <p>2 ohlc_p95_bps</p>
          <p>3 ohlc_max_bps</p>
          <p>4 direction_match_bps</p>
          <p>5 outlier_count</p>
          <p>6 score_bps</p>
        </div>

        {/* Price Integrity Contract — blue */}
        <div
          className="absolute z-10 rounded-[12px] border-[1.5px] px-[2%] py-[2.4%]"
          style={{
            ...boxStyle({ x: 1177, y: 18, width: 427, height: 372 }),
            borderColor: "#60a5fa",
            background: "rgba(37,99,235,0.10)",
          }}
        >
          <p className="text-[7px] font-semibold text-[#93c5fd] min-[520px]:text-[9px] min-[760px]:text-[11px]">
            Price Integrity Contract
          </p>
          <div className="absolute top-[5.8%] right-[5.2%]">
            <Image
              src="/sol.png"
              alt="Contract"
              width={64}
              height={60}
              className="h-auto w-[20px] min-[520px]:w-[28px] min-[760px]:w-[36px]"
            />
          </div>
        </div>

        {/* Report box — emerald green */}
        <div
          className="absolute z-20 rounded-[12px] border-[1.5px] border-[#00d88b] bg-[rgba(0,128,88,0.46)] px-[1.3%] py-[1.7%] text-[6px] font-semibold text-[#d7ffe9] min-[520px]:text-[8px] min-[760px]:text-[10px]"
          style={{
            ...boxStyle({ x: 1254, y: 126, width: 252, height: 228 }),
            lineHeight: 1.35,
          }}
        >
          <p>Report</p>
          <p>epoch_id</p>
          <p>window_start</p>
          <p>score_bps</p>
          <p>is_passed</p>
          <p>failure_flags</p>
        </div>

        <TextLabel x={372} y={108}>
          ohlc source of truth
        </TextLabel>
        <TextLabel x={443} y={260}>
          attested OHLC
        </TextLabel>

        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-40 h-full w-full"
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        >
          <defs>
            <marker
              id="price-integrity-arrowhead"
              markerHeight="9"
              markerWidth="10"
              orient="auto"
              refX="9"
              refY="4.5"
            >
              <path
                d="M 0 0 L 9 4.5 L 0 9"
                fill="none"
                stroke={LINE_COLOR}
                strokeWidth="1.8"
              />
            </marker>
            <filter
              id="price-integrity-flow-glow"
              x="-120%"
              y="-120%"
              width="340%"
              height="340%"
            >
              <feGaussianBlur stdDeviation="2.3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <FlowPath d="M 306 141 H 628" durationSeconds={2.25} />
          <FlowPath
            d="M 307 389 H 460 Q 469 389 469 380 V 318 Q 469 289 498 289 H 632"
            delaySeconds={0.18}
            durationSeconds={2.55}
          />
          <FlowPath
            d="M 735 190 V 242"
            delaySeconds={0.08}
            durationSeconds={1.55}
          />
          <FlowPath
            d="M 736 340 V 403"
            delaySeconds={0.12}
            durationSeconds={1.7}
          />
          <FlowPath
            d="M 739 501 V 581"
            delaySeconds={0.16}
            durationSeconds={1.9}
          />
          <FlowPath
            d="M 857 724 H 957 Q 958 724 958 723 V 225 H 1254"
            delaySeconds={0.22}
            durationSeconds={2.8}
          />
        </svg>
      </div>
    </div>
  );
};
