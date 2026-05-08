"use client";

import type { CSSProperties } from "react";
import { memo } from "react";
import styles from "./BetWinEffect.module.css";

const WIN_BURST_PARTICLES = [
  { id: "p01", tx: 65, ty: -25, rotation: 45, delay: 0, size: 8 },
  { id: "p02", tx: -38, ty: -72, rotation: -30, delay: 0.03, size: 12 },
  { id: "p03", tx: 78, ty: 10, rotation: 90, delay: 0.06, size: 7 },
  { id: "p04", tx: -74, ty: 28, rotation: -60, delay: 0.09, size: 11 },
  { id: "p05", tx: 20, ty: 76, rotation: 120, delay: 0.12, size: 9 },
  { id: "p06", tx: -28, ty: -75, rotation: -15, delay: 0.15, size: 13 },
  { id: "p07", tx: 76, ty: -29, rotation: 75, delay: 0.18, size: 7 },
  { id: "p08", tx: -75, ty: -13, rotation: -100, delay: 0.21, size: 12 },
  { id: "p09", tx: 31, ty: -74, rotation: 200, delay: 0.24, size: 10 },
  { id: "p10", tx: -44, ty: 64, rotation: -45, delay: 0.27, size: 8 },
  { id: "p11", tx: 50, ty: 59, rotation: 160, delay: 0.05, size: 13 },
  { id: "p12", tx: -64, ty: -49, rotation: -80, delay: 0.08, size: 6 },
  { id: "p13", tx: 69, ty: -54, rotation: 55, delay: 0.11, size: 10 },
  { id: "p14", tx: -15, ty: 78, rotation: -130, delay: 0.14, size: 9 },
  { id: "p15", tx: 74, ty: 36, rotation: 30, delay: 0.17, size: 12 },
  { id: "p16", tx: -73, ty: -30, rotation: -50, delay: 0.2, size: 7 },
  { id: "p17", tx: 38, ty: 70, rotation: 110, delay: 0.23, size: 11 },
  { id: "p18", tx: -54, ty: -65, rotation: -90, delay: 0.26, size: 9 },
  { id: "p19", tx: 68, ty: 25, rotation: 65, delay: 0.29, size: 14 },
  { id: "p20", tx: -25, ty: 74, rotation: -160, delay: 0.32, size: 7 },
  { id: "p21", tx: 76, ty: -14, rotation: 85, delay: 0.02, size: 10 },
  { id: "p22", tx: -74, ty: 20, rotation: -35, delay: 0.07, size: 12 },
  { id: "p23", tx: 11, ty: -78, rotation: 175, delay: 0.13, size: 8 },
  { id: "p24", tx: -59, ty: 56, rotation: -70, delay: 0.16, size: 13 },
  { id: "p25", tx: 55, ty: -69, rotation: 40, delay: 0.19, size: 9 },
  { id: "p26", tx: -46, ty: -36, rotation: -115, delay: 0.22, size: 12 },
  { id: "p27", tx: 71, ty: 44, rotation: 95, delay: 0.25, size: 10 },
  { id: "p28", tx: -21, ty: -76, rotation: -25, delay: 0.28, size: 7 },
  { id: "p29", tx: 61, ty: -46, rotation: 140, delay: 0.31, size: 13 },
  { id: "p30", tx: -36, ty: 22, rotation: -55, delay: 0.04, size: 9 },
] as const;

type BetWinParticleStyle = CSSProperties & {
  "--bet-win-delay": string;
  "--bet-win-rotation": string;
  "--bet-win-size": string;
  "--bet-win-translate-x": string;
  "--bet-win-translate-y": string;
};

function buildParticleStyle({
  delay,
  rotation,
  size,
  tx,
  ty,
}: (typeof WIN_BURST_PARTICLES)[number]): BetWinParticleStyle {
  return {
    "--bet-win-delay": `${delay}s`,
    "--bet-win-rotation": `${rotation}deg`,
    "--bet-win-size": `${size}px`,
    "--bet-win-translate-x": `${tx}px`,
    "--bet-win-translate-y": `${ty}px`,
  };
}

// Inline primitives avoid the extra SVG document and heavy filter paints that
// made the previous object-based win burst stutter under frequent updates.
export const BetWinEffect = memo(function BetWinEffect() {
  return (
    <div className={styles.effect} aria-hidden>
      <span className={`${styles.ring} ${styles.outerRing}`} />
      <span className={`${styles.ring} ${styles.innerRing}`} />
      <span className={styles.corePulse} />

      {WIN_BURST_PARTICLES.map((particle) => (
        <span key={particle.id} className={styles.particleSlot}>
          <span
            className={styles.particle}
            style={buildParticleStyle(particle)}
          >
            $
          </span>
        </span>
      ))}
    </div>
  );
});
