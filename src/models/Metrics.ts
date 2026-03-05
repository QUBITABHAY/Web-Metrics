/**
 * Metrics.ts
 *
 * Data models for PageSpeed Insights API responses.
 * Separates the raw API shape (MetricsData) from the
 * domain object (Metrics) that provides formatted getters.
 */

// ── Sub-interfaces ──────────────────────────────────────────────────

/** A single Lighthouse opportunity or diagnostic audit. */
export interface AuditItem {
  /** Human-readable title (e.g. "Reduce unused JavaScript") */
  title: string;
  /** Display value from Lighthouse (e.g. "1.2 s", "450 KiB") */
  displayValue: string;
  /** Score 0-1 or null if informational */
  score: number | null;
}

/** A row from the resource-summary audit (scripts, images, etc.) */
export interface ResourceBreakdownItem {
  /** Resource type label (e.g. "Script", "Image", "Stylesheet") */
  resourceType: string;
  /** Number of requests for this type */
  requestCount: number;
  /** Transfer size in bytes */
  transferSize: number;
}

// ── Raw API response shape ──────────────────────────────────────────
/** Describes the full subset of a PageSpeed API response we use. */
export interface MetricsData {
  // ── Lighthouse category scores (0 – 1) ────────────────────────
  performanceScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  seoScore: number;

  // ── Core Web Vitals (milliseconds / unitless) ─────────────────
  fcpMs: number;
  lcpMs: number;
  clsValue: number;
  ttfbMs: number;
  ttiMs: number;
  speedIndexMs: number;

  // ── Additional performance metrics ────────────────────────────
  tbtMs: number;
  inpMs: number;
  domSize: number;
  renderBlockingCount: number;

  // ── Page weight ───────────────────────────────────────────────
  totalRequests: number;
  totalSizeBytes: number;

  // ── Audits ────────────────────────────────────────────────────
  opportunities: AuditItem[];
  diagnostics: AuditItem[];
  resourceBreakdown: ResourceBreakdownItem[];
}

// ── Domain model with convenient getters ────────────────────────────
/**
 * Wraps raw MetricsData and exposes human-friendly values.
 * All heavy formatting is deferred to the Formatter utility so
 * this class stays focused on data access.
 */
export class Metrics {
  private readonly data: MetricsData;

  constructor(data: MetricsData) {
    this.data = data;
  }

  // ── Category scores (scaled to 0-100) ───────────────────────────
  get performanceScore(): number {
    return Math.round(this.data.performanceScore * 100);
  }
  get accessibilityScore(): number {
    return Math.round(this.data.accessibilityScore * 100);
  }
  get bestPracticesScore(): number {
    return Math.round(this.data.bestPracticesScore * 100);
  }
  get seoScore(): number {
    return Math.round(this.data.seoScore * 100);
  }

  // ── Core Web Vitals (raw ms / unitless values) ──────────────────
  get fcp(): number {
    return this.data.fcpMs;
  }
  get lcp(): number {
    return this.data.lcpMs;
  }
  get cls(): number {
    return this.data.clsValue;
  }
  get ttfb(): number {
    return this.data.ttfbMs;
  }
  get tti(): number {
    return this.data.ttiMs;
  }
  get speedIndex(): number {
    return this.data.speedIndexMs;
  }

  // ── Additional performance metrics ──────────────────────────────
  get tbt(): number {
    return this.data.tbtMs;
  }
  get inp(): number {
    return this.data.inpMs;
  }
  get domSize(): number {
    return this.data.domSize;
  }
  get renderBlockingCount(): number {
    return this.data.renderBlockingCount;
  }

  // ── Page weight ─────────────────────────────────────────────────
  get totalRequests(): number {
    return this.data.totalRequests;
  }
  get totalSizeBytes(): number {
    return this.data.totalSizeBytes;
  }

  // ── Audits ──────────────────────────────────────────────────────
  get opportunities(): AuditItem[] {
    return this.data.opportunities;
  }
  get diagnostics(): AuditItem[] {
    return this.data.diagnostics;
  }
  get resourceBreakdown(): ResourceBreakdownItem[] {
    return this.data.resourceBreakdown;
  }
}
