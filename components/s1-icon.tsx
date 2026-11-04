import { ImageResponse } from "next/og";

// S1-App-Icon, Variante „Gabel“: Die 1 zweigt im rechten Winkel aus dem S ab.
const GROUND = "#0c0d10";
const INK = "#eceef1";
// INVARIANT: waagrechte und senkrechte Striche liegen auf Vielfachen von 4, damit sie bei 16 px auf ganze Pixel fallen.
const STROKE = 8;
// INVARIANT: S und 1 laufen weit über die Fläche hinaus, damit sie auch verkleinert noch an den Rändern austreten.
const S = "M88 -44 L28 16 H16 L8 24 L16 32 H28 L36 40 L28 48 H16 L-44 108";
const ONE = "M52 12 V52 L108 108 M30.828 34.828 L50.828 14.828";
/** Vollflächige Layouts (Apple, maskable) verkleinern das Glyph wie ios/IconComposer/foreground.svg. */
const FULL = "translate(7.277 6.48) scale(0.7975)";

type Layout = "tile" | "full";

/** `tile`: abgerundete Kachel mit transparenten Ecken (Favicon, Manifest). `full`: deckend, das System maskiert selbst. */
function S1Icon({ layout }: { layout: Layout }) {
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" fill="none">
      <defs>
        <clipPath id="s1">
          <rect width={64} height={64} rx={layout === "tile" ? 16 : 0} />
        </clipPath>
      </defs>
      <g clipPath="url(#s1)">
        <rect width={64} height={64} fill={GROUND} />
        <g
          stroke={INK}
          strokeWidth={STROKE}
          strokeLinecap="butt"
          strokeLinejoin="miter"
          transform={layout === "full" ? FULL : undefined}
        >
          <path d={S} />
          <path d={ONE} />
        </g>
      </g>
    </svg>
  );
}

export const iconResponse = (size: number, layout: Layout) =>
  new ImageResponse(<S1Icon layout={layout} />, { width: size, height: size });
