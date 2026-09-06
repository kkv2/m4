/**
 * The M4 product mark (FR-044). The asset is a square crop of the README hero
 * banner, so it is already drawn for the dark base tone and stays legible at
 * icon scale without a light-mode variant (FR-045).
 */
export function Mark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- a fixed-size local SVG
       gains nothing from next/image's optimisation pipeline. */
    <img
      src="/mark.svg"
      alt="M4"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
