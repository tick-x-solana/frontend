import Image from "next/image";
import React from "react";

const CANVAS_WIDTH = 1613;
const CANVAS_HEIGHT = 947;
const LINE_COLOR = "#d9dee7";
const FLOW_COLOR = "#9fffe3";
const FLOW_ARROW_DELAYS_SECONDS = [0, 0.74, 1.48];

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

function Frame({
  className,
  children,
  box,
}: PositionedProps & { box: DiagramBox }) {
  return (
    <div
      className={[
        "absolute z-10 rounded-[24px] border-[1.5px] bg-[#05080f]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ ...boxStyle(box), borderColor: LINE_COLOR }}
    >
      {children}
    </div>
  );
}

function Task({ text, box }: { text: string; box: DiagramBox }) {
  return (
    <div
      className="absolute z-20 flex items-center justify-center rounded-[18px] border-[1.5px] bg-[#05080f] px-2 text-center text-[7px] font-semibold whitespace-nowrap text-text-main min-[520px]:text-[9px] min-[760px]:text-[11px]"
      style={{ ...boxStyle(box), borderColor: LINE_COLOR }}
    >
      {text}
    </div>
  );
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
          <g key={`${d}-${beginSeconds}`} filter="url(#price-integrity-flow-glow)">
            <path
              d="M -13 -7 L 0 0 L -13 7"
              fill="none"
              stroke={FLOW_COLOR}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="4"
            />
            <animateMotion
              begin={`${beginSeconds}s`}
              calcMode="paced"
              dur={`${durationSeconds}s`}
              path={d}
              repeatCount="indefinite"
              rotate="auto"
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
        "absolute z-50 text-[7px] font-semibold whitespace-nowrap text-text-main min-[520px]:text-[9px] min-[760px]:text-[12px]",
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
    <div className="mx-auto w-full max-w-[980px] overflow-hidden rounded-[14px] border border-white/10 bg-background-main p-2">
      <div className="relative aspect-[1613/947] w-full overflow-hidden rounded-[12px] border border-white/30 bg-[#04070d]">
        <Frame
          box={{ x: 12, y: 34, width: 294, height: 204 }}
          className="px-[2.3%] py-[2.7%]"
        >
          <p
            className="text-[7px] font-semibold text-text-main min-[520px]:text-[10px] min-[760px]:text-[13px]"
            style={{ lineHeight: 1.35 }}
          >
            Binance/Chainlink
            <br />
            Data Feeds
          </p>
          <div className="mt-[12%] ml-[30%] flex h-[37%] w-[30%] items-center justify-center bg-white">
            <span className="text-[24px] text-[#2f60e8] min-[520px]:text-[34px] min-[760px]:text-[48px]">
              ⬡
            </span>
          </div>
        </Frame>

        <Frame
          box={{ x: 11, y: 278, width: 297, height: 205 }}
          className="px-[2.3%] py-[2.9%]"
        >
          <p className="text-[7px] font-semibold text-text-main min-[520px]:text-[10px] min-[760px]:text-[13px]">
            TickX price API
          </p>
          <div className="mt-[18%] ml-[24%]">
            <Image
              src="/tickX.png"
              alt="TickX"
              width={80}
              height={80}
              className="h-auto w-[34%]"
            />
          </div>
        </Frame>

        <Frame
          box={{ x: 440, y: 12, width: 603, height: 923 }}
          className="px-[2%] py-[2.6%]"
        >
          <p className="text-[7px] font-semibold text-text-main min-[520px]:text-[10px] min-[760px]:text-[13px]">
            Switchboard TEE
          </p>
          <div className="absolute top-[1.7%] right-[7.2%]">
            <Image
              src="/sol.png"
              alt="Switchboard"
              width={82}
              height={82}
              className="h-auto w-[32px] min-[520px]:w-[48px] min-[760px]:w-[68px]"
            />
          </div>
        </Frame>

        <Task text="HTTP Task" box={{ x: 628, y: 93, width: 209, height: 97 }} />
        <Task text="HTTP Task" box={{ x: 632, y: 242, width: 209, height: 98 }} />
        <Task
          text="Comparision Task"
          box={{ x: 634, y: 403, width: 209, height: 98 }}
        />

        <div
          className="absolute z-20 rounded-[20px] border-[1.5px] border-[#9a7bff] bg-[rgba(107,86,168,0.78)] px-[1.5%] py-[1.8%] text-[5px] font-semibold whitespace-nowrap text-[#efe8ff] min-[520px]:text-[7px] min-[760px]:text-[9px]"
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

        <Frame
          box={{ x: 1177, y: 18, width: 427, height: 372 }}
          className="px-[2%] py-[2.4%]"
        >
          <p className="text-[7px] font-semibold text-text-main min-[520px]:text-[9px] min-[760px]:text-[11px]">
            Price Integrity Contract
          </p>
          <div className="absolute top-[5.8%] right-[5.2%]">
            <Image
              src="/sol.png"
              alt="Contract"
              width={64}
              height={60}
              className="h-auto w-[36px] min-[520px]:w-[50px] min-[760px]:w-[64px]"
            />
          </div>
        </Frame>

        <div
          className="absolute z-20 rounded-[21px] border-[1.5px] border-[#00d88b] bg-[rgba(0,128,88,0.46)] px-[1.3%] py-[1.7%] text-[6px] font-semibold text-[#d7ffe9] min-[520px]:text-[8px] min-[760px]:text-[10px]"
          style={{
            ...boxStyle({ x: 1272, y: 137, width: 208, height: 176 }),
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
            d="M 857 724 H 957 Q 958 724 958 723 V 225 H 1272"
            delaySeconds={0.22}
            durationSeconds={2.8}
          />
        </svg>
      </div>
    </div>
  );
};
