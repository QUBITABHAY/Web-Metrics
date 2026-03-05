/**
 * PageSpeedService.ts
 *
 * Single responsibility: communicate with the Google PageSpeed
 * Insights API v5 and return a domain Metrics object.
 *
 * The API key is injected via the constructor so this class
 * is easily testable and never reads preferences itself.
 */

import {
  Metrics,
  type MetricsData,
  type AuditItem,
  type ResourceBreakdownItem,
} from "../models/Metrics";

/** Allowed analysis strategies. */
export type Strategy = "mobile" | "desktop";

export class PageSpeedService {
  private static readonly BASE_URL =
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // ── Public API ──────────────────────────────────────────────────

  /**
   * Fetches metrics for the given URL.
   * Throws a user-friendly error on network or API failures.
   */
  async fetchMetrics(url: string, strategy: Strategy): Promise<Metrics> {
    const endpoint = this.buildEndpoint(url, strategy);

    const response = await fetch(endpoint);

    // Handle HTTP errors from the API
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      const detail = body?.error?.message ?? response.statusText;
      throw new Error(`PageSpeed API error (${response.status}): ${detail}`);
    }

    const data: unknown = await response.json();
    return this.parseResponse(data);
  }

  // ── Private helpers ─────────────────────────────────────────────

  /** Builds the full API endpoint URL with query parameters. */
  private buildEndpoint(url: string, strategy: Strategy): string {
    const params = new URLSearchParams({
      url,
      key: this.apiKey,
      strategy,
    });

    // Request all four Lighthouse categories
    const categories = [
      "performance",
      "accessibility",
      "best-practices",
      "seo",
    ];
    for (const cat of categories) {
      params.append("category", cat);
    }

    return `${PageSpeedService.BASE_URL}?${params.toString()}`;
  }

  /**
   * Parses the raw JSON response into our MetricsData shape.
   * Defensively accesses nested fields — the PageSpeed response
   * is deeply nested and values may occasionally be missing.
   */
  private parseResponse(data: unknown): Metrics {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = data as any;

    const lighthouse = json?.lighthouseResult;
    if (!lighthouse) {
      throw new Error("Unexpected API response: missing lighthouseResult");
    }

    const audits = lighthouse.audits ?? {};
    const categories = lighthouse.categories ?? {};

    // Helper to safely read a numeric audit value
    const numericAudit = (id: string): number => audits[id]?.numericValue ?? 0;

    // ── Resource summary ────────────────────────────────────────
    const resourceItems: Array<{
      resourceType?: string;
      label?: string;
      requestCount?: number;
      transferSize?: number;
    }> = audits["resource-summary"]?.details?.items ?? [];

    // First item is the "Total" row
    const totalRow = resourceItems[0] ?? {};

    // Remaining rows are per-type breakdowns (skip "Total")
    const resourceBreakdown: ResourceBreakdownItem[] = resourceItems
      .slice(1)
      .filter((item) => (item.requestCount ?? 0) > 0)
      .map((item) => ({
        resourceType: item.label ?? item.resourceType ?? "Other",
        requestCount: item.requestCount ?? 0,
        transferSize: item.transferSize ?? 0,
      }));

    // ── Opportunities (top 5 failing audits with savings) ───────
    const opportunities = this.extractAudits(
      lighthouse,
      "opportunity",
      audits,
      5,
    );

    // ── Diagnostics (top 5 informational audits) ────────────────
    const diagnostics = this.extractAudits(lighthouse, "diagnostic", audits, 5);

    // ── Render-blocking resources ───────────────────────────────
    const renderBlockingItems: unknown[] =
      audits["render-blocking-resources"]?.details?.items ?? [];

    // ── DOM size ────────────────────────────────────────────────
    const domSize: number = numericAudit("dom-size");

    const metricsData: MetricsData = {
      // Category scores
      performanceScore: categories.performance?.score ?? 0,
      accessibilityScore: categories.accessibility?.score ?? 0,
      bestPracticesScore: categories["best-practices"]?.score ?? 0,
      seoScore: categories.seo?.score ?? 0,

      // Core Web Vitals
      fcpMs: numericAudit("first-contentful-paint"),
      lcpMs: numericAudit("largest-contentful-paint"),
      clsValue: numericAudit("cumulative-layout-shift"),
      ttfbMs: numericAudit("server-response-time"),
      ttiMs: numericAudit("interactive"),
      speedIndexMs: numericAudit("speed-index"),

      // Additional metrics
      tbtMs: numericAudit("total-blocking-time"),
      inpMs: numericAudit("experimental-interaction-to-next-paint"),
      domSize,
      renderBlockingCount: renderBlockingItems.length,

      // Page weight
      totalRequests: totalRow.requestCount ?? 0,
      totalSizeBytes: totalRow.transferSize ?? 0,

      // Audits
      opportunities,
      diagnostics,
      resourceBreakdown,
    };

    return new Metrics(metricsData);
  }

  /**
   * Extracts audit items of a given group (opportunity | diagnostic)
   * from the Lighthouse performance category, sorted by score (worst first),
   * limited to `limit` items.
   */
  private extractAudits(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lighthouse: any,
    group: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    audits: Record<string, any>,
    limit: number,
  ): AuditItem[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const auditRefs: Array<{ id: string; group?: string }> =
      lighthouse.categories?.performance?.auditRefs ?? [];

    return auditRefs
      .filter((ref) => ref.group === group)
      .map((ref) => {
        const audit = audits[ref.id];
        if (!audit) return null;
        // Skip audits that "pass" (score === 1) — they aren't actionable
        if (audit.score === 1) return null;
        return {
          title: audit.title ?? ref.id,
          displayValue: audit.displayValue ?? "",
          score: audit.score ?? null,
        } as AuditItem;
      })
      .filter((item): item is AuditItem => item !== null)
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
      .slice(0, limit);
  }
}
