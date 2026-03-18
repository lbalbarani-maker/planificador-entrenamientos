declare module 'canvas-confetti' {
  interface Options {
    particleCount?: number;
    spread?: number;
    origin?: { x: number; y: number };
    colors?: string[];
    ticks?: number;
    gravity?: number;
    drift?: number;
    flat?: boolean;
    scalar?: number;
    shapes?: string[];
    zIndex?: number;
    disableForReducedMotion?: boolean;
  }

  function confetti(options?: Options): void;
  export default confetti;
}
