/**
 * Formatter.ts
 *
 * Pure static utility class — no state, no side-effects.
 * Handles all presentation-layer formatting so that neither
 * the Metrics model nor the React UI need to know about
 * display concerns.
 */

import { Color, Icon, Image } from "@raycast/api";

/** Supported Core Web Vital metric names for threshold checks. */
export type MetricName =
  | "fcp"
  | "lcp"
  | "cls"
  | "ttfb"
  | "tti"
  | "tbt"
  | "inp"
  | "speedIndex";

/**
 * Lighthouse thresholds: [good, needsImprovement].
 * A value < good → Green, < needsImprovement → Yellow, else → Red.
 */
const METRIC_THRESHOLDS: Record<MetricName, [number, number]> = {
  fcp: [1800, 3000], // ms
  lcp: [2500, 4000], // ms
  cls: [0.1, 0.25], // unitless
  ttfb: [800, 1800], // ms
  tti: [3800, 7300], // ms
  tbt: [200, 600], // ms
  inp: [200, 500], // ms
  speedIndex: [3400, 5800], // ms
};

export class Formatter {
  // ── Time formatting ─────────────────────────────────────────────

  /**
   * Converts milliseconds into a human-readable string.
   * Values ≥ 1 000 ms are shown in seconds (e.g. "2.4 s"),
   * smaller values stay in milliseconds (e.g. "320 ms").
   */
  static toReadableTime(ms: number): string {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(1)} s`;
    }
    return `${Math.round(ms)} ms`;
  }

  // ── Score formatting ────────────────────────────────────────────

  /**
   * Maps a 0-100 score to a native Raycast Color object.
   *   90 – 100 → Green
   *   50 –  89 → Yellow
   *    0 –  49 → Red
   */
  static toScoreColor(score: number): Color {
    if (score >= 90) return Color.Green;
    if (score >= 50) return Color.Yellow;
    return Color.Red;
  }

  /**
   * Returns a textual label for the score range.
   */
  static toScoreLabel(score: number): string {
    if (score >= 90) return "Good";
    if (score >= 50) return "Needs Improvement";
    return "Poor";
  }

  /**
   * Maps a 0-100 score to a native Raycast Image (Icon + Color)
   */
  static toScoreIcon(score: number): Image {
    if (score >= 90)
      return { source: Icon.CheckCircle, tintColor: Color.Green };
    if (score >= 50) return { source: Icon.Warning, tintColor: Color.Yellow };
    return { source: Icon.XMarkCircle, tintColor: Color.Red };
  }

  // ── Per-metric threshold formatting ───────────────────────────────

  /**
   * Returns a Raycast Color based on official Lighthouse thresholds.
   */
  static toMetricColor(metric: MetricName, value: number): Color {
    const [good, mid] = METRIC_THRESHOLDS[metric];
    if (value <= good) return Color.Green;
    if (value <= mid) return Color.Yellow;
    return Color.Red;
  }

  /**
   * Returns a native Raycast Image Object (Icon + Color) based on thresholds.
   */
  static toMetricIcon(metric: MetricName, value: number): Image {
    const [good, mid] = METRIC_THRESHOLDS[metric];
    if (value <= good) {
      return { source: Icon.CheckCircle, tintColor: Color.Green };
    }
    if (value <= mid) {
      return { source: Icon.Warning, tintColor: Color.Yellow };
    }
    return { source: Icon.XMarkCircle, tintColor: Color.Red };
  }

  // ── URL helpers ─────────────────────────────────────────────────

  /**
   * Ensures the URL has a protocol prefix.
   * - Trims whitespace
   * - Prepends "https://" when no protocol is present
   */
  static normalizeUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) return trimmed;

    // Already has a protocol
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    return `https://${trimmed}`;
  }

  /** Extracts just the hostname for display purposes (e.g. "example.com") */
  static extractHostname(url: string): string {
    try {
      return new URL(this.normalizeUrl(url)).hostname;
    } catch {
      return url;
    }
  }

  // ── Size formatting ─────────────────────────────────────────────

  /**
   * Converts raw bytes to a human-readable file-size string.
   * e.g. 1 536 000 → "1.46 MB"
   */
  static toReadableSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(2)} ${units[i]}`;
  }

  // ── CLS formatting ─────────────────────────────────────────────

  /**
   * Formats Cumulative Layout Shift to 3 decimal places.
   * CLS is unitless, so no suffix is added.
   */
  static toReadableCls(value: number): string {
    return value.toFixed(3);
  }

  // ── Number formatting ──────────────────────────────────────────

  /**
   * Formats a large number with comma separators.
   * e.g. 14350 → "14,350"
   */
  static toFormattedNumber(value: number): string {
    return value.toLocaleString();
  }
}
