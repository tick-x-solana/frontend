"use client";

export function BetWinEffect() {
  return (
    <svg
      width="200"
      height="200"
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      className="h-[200px] w-[200px]"
    >
      <style>{`
        @keyframes bw-fly {
          0% { transform: translate(0,0) scale(0) rotate(0deg); opacity: 1; }
          20% { opacity: 1; }
          36% { opacity: 0.5; }
          42% { transform: translate(var(--tx), var(--ty)) scale(1.3) rotate(var(--rt)); opacity: 0; }
          42.1% { transform: translate(0,0) scale(0) rotate(0deg); opacity: 0; }
          100% { transform: translate(0,0) scale(0) rotate(0deg); opacity: 0; }
        }
        .bw-p {
          fill: #D0F7DC;
          font-family: Arial, sans-serif;
          font-weight: bold;
          filter: drop-shadow(0 0 8px #D0F7DC) drop-shadow(0 0 14px #a0ffbe);
          transform-origin: 200px 200px;
          transform: translate(0, 0) scale(0) rotate(0deg);
          opacity: 0;
          animation: bw-fly 2s cubic-bezier(0.1, 0.6, 0.3, 1);
        }
        .bw-p01 { --tx: 130px; --ty: -50px; --rt: 45deg; animation-delay: .00s; font-size:16px; }
        .bw-p02 { --tx: -75px; --ty:-145px; --rt: -30deg; animation-delay: .03s; font-size:24px; }
        .bw-p03 { --tx: 155px; --ty: 20px; --rt: 90deg; animation-delay: .06s; font-size:14px; }
        .bw-p04 { --tx:-148px; --ty: 55px; --rt: -60deg; animation-delay: .09s; font-size:22px; }
        .bw-p05 { --tx: 40px; --ty: 152px; --rt: 120deg; animation-delay: .12s; font-size:18px; }
        .bw-p06 { --tx: -55px; --ty:-150px; --rt: -15deg; animation-delay: .15s; font-size:26px; }
        .bw-p07 { --tx: 152px; --ty: -58px; --rt: 75deg; animation-delay: .18s; font-size:13px; }
        .bw-p08 { --tx:-150px; --ty: -25px; --rt:-100deg; animation-delay: .21s; font-size:23px; }
        .bw-p09 { --tx: 62px; --ty:-148px; --rt: 200deg; animation-delay: .24s; font-size:19px; }
        .bw-p10 { --tx: -88px; --ty: 128px; --rt: -45deg; animation-delay: .27s; font-size:15px; }
        .bw-p11 { --tx: 100px; --ty: 118px; --rt: 160deg; animation-delay: .05s; font-size:25px; }
        .bw-p12 { --tx:-128px; --ty: -98px; --rt: -80deg; animation-delay: .08s; font-size:12px; }
        .bw-p13 { --tx: 138px; --ty:-108px; --rt: 55deg; animation-delay: .11s; font-size:20px; }
        .bw-p14 { --tx: -30px; --ty: 155px; --rt:-130deg; animation-delay: .14s; font-size:17px; }
        .bw-p15 { --tx: 148px; --ty: 72px; --rt: 30deg; animation-delay: .17s; font-size:24px; }
        .bw-p16 { --tx:-145px; --ty: -60px; --rt: -50deg; animation-delay: .20s; font-size:14px; }
        .bw-p17 { --tx: 75px; --ty: 140px; --rt: 110deg; animation-delay: .23s; font-size:22px; }
        .bw-p18 { --tx:-108px; --ty:-130px; --rt: -90deg; animation-delay: .26s; font-size:18px; }
        .bw-p19 { --tx: 135px; --ty: 50px; --rt: 65deg; animation-delay: .29s; font-size:27px; }
        .bw-p20 { --tx: -50px; --ty: 148px; --rt:-160deg; animation-delay: .32s; font-size:13px; }
        .bw-p21 { --tx: 152px; --ty: -28px; --rt: 85deg; animation-delay: .02s; font-size:19px; }
        .bw-p22 { --tx:-148px; --ty: 40px; --rt: -35deg; animation-delay: .07s; font-size:23px; }
        .bw-p23 { --tx: 22px; --ty:-155px; --rt: 175deg; animation-delay: .13s; font-size:15px; }
        .bw-p24 { --tx:-118px; --ty: 112px; --rt: -70deg; animation-delay: .16s; font-size:26px; }
        .bw-p25 { --tx: 110px; --ty:-138px; --rt: 40deg; animation-delay: .19s; font-size:17px; }
        .bw-p26 { --tx: -92px; --ty: -72px; --rt:-115deg; animation-delay: .22s; font-size:24px; }
        .bw-p27 { --tx: 142px; --ty: 88px; --rt: 95deg; animation-delay: .25s; font-size:20px; }
        .bw-p28 { --tx: -42px; --ty:-152px; --rt: -25deg; animation-delay: .28s; font-size:14px; }
        .bw-p29 { --tx: 122px; --ty: -92px; --rt: 140deg; animation-delay: .31s; font-size:25px; }
        .bw-p30 { --tx: -72px; --ty: 45px; --rt: -55deg; animation-delay: .04s; font-size:18px; }
      `}</style>

      <circle
        cx="200"
        cy="200"
        fill="none"
        stroke="#D0F7DC"
        strokeWidth="3"
        r="4"
        opacity="0"
      >
        <animate attributeName="r" values="4;45;45" keyTimes="0;0.33;1" dur="2s" begin="0.15s" repeatCount="1" />
        <animate attributeName="opacity" values="0.7;0;0" keyTimes="0;0.33;1" dur="2s" begin="0.15s" repeatCount="1" />
        <animate attributeName="stroke-width" values="3;0;0" keyTimes="0;0.33;1" dur="2s" begin="0.15s" repeatCount="1" />
      </circle>
      <circle
        cx="200"
        cy="200"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        r="4"
        opacity="0"
      >
        <animate attributeName="r" values="4;30;30" keyTimes="0;0.27;1" dur="2s" begin="0.3s" repeatCount="1" />
        <animate attributeName="opacity" values="0.5;0;0" keyTimes="0;0.27;1" dur="2s" begin="0.3s" repeatCount="1" />
        <animate attributeName="stroke-width" values="2;0;0" keyTimes="0;0.27;1" dur="2s" begin="0.3s" repeatCount="1" />
      </circle>
      <circle cx="200" cy="200" r="5" fill="#ffffff" opacity="0">
        <animate attributeName="r" values="5;18;1;1" keyTimes="0;0.15;0.21;1" dur="2s" repeatCount="1" />
        <animate attributeName="opacity" values="1;0.7;0;0" keyTimes="0;0.15;0.21;1" dur="2s" repeatCount="1" />
      </circle>

      <text className="bw-p bw-p01" x="200" y="207">$</text>
      <text className="bw-p bw-p02" x="200" y="207">$</text>
      <text className="bw-p bw-p03" x="200" y="207">$</text>
      <text className="bw-p bw-p04" x="200" y="207">$</text>
      <text className="bw-p bw-p05" x="200" y="207">$</text>
      <text className="bw-p bw-p06" x="200" y="207">$</text>
      <text className="bw-p bw-p07" x="200" y="207">$</text>
      <text className="bw-p bw-p08" x="200" y="207">$</text>
      <text className="bw-p bw-p09" x="200" y="207">$</text>
      <text className="bw-p bw-p10" x="200" y="207">$</text>
      <text className="bw-p bw-p11" x="200" y="207">$</text>
      <text className="bw-p bw-p12" x="200" y="207">$</text>
      <text className="bw-p bw-p13" x="200" y="207">$</text>
      <text className="bw-p bw-p14" x="200" y="207">$</text>
      <text className="bw-p bw-p15" x="200" y="207">$</text>
      <text className="bw-p bw-p16" x="200" y="207">$</text>
      <text className="bw-p bw-p17" x="200" y="207">$</text>
      <text className="bw-p bw-p18" x="200" y="207">$</text>
      <text className="bw-p bw-p19" x="200" y="207">$</text>
      <text className="bw-p bw-p20" x="200" y="207">$</text>
      <text className="bw-p bw-p21" x="200" y="207">$</text>
      <text className="bw-p bw-p22" x="200" y="207">$</text>
      <text className="bw-p bw-p23" x="200" y="207">$</text>
      <text className="bw-p bw-p24" x="200" y="207">$</text>
      <text className="bw-p bw-p25" x="200" y="207">$</text>
      <text className="bw-p bw-p26" x="200" y="207">$</text>
      <text className="bw-p bw-p27" x="200" y="207">$</text>
      <text className="bw-p bw-p28" x="200" y="207">$</text>
      <text className="bw-p bw-p29" x="200" y="207">$</text>
      <text className="bw-p bw-p30" x="200" y="207">$</text>
    </svg>
  );
}
