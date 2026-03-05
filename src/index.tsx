/**
 * index.tsx
 *
 * Main Raycast command for "Web Metrics".
 *
 * Architecture:
 *  - No business logic lives here — it all delegates to
 *    PageSpeedService, HistoryService, and Formatter.
 *  - Services are instantiated once and injected as plain
 *    variables (the simplest form of DI for a Raycast extension).
 */

import {
  Action,
  ActionPanel,
  List,
  Form,
  getPreferenceValues,
  openExtensionPreferences,
  showToast,
  Toast,
  Clipboard,
  Icon,
  Color,
} from "@raycast/api";
import React, { useEffect, useState } from "react";

import { Metrics } from "./models/Metrics";
import { HistoryService } from "./services/HistoryService";
import { PageSpeedService, type Strategy } from "./services/PageSpeedService";
import { Formatter } from "./utils/Formatter";

// ── Preferences shape ─────────────────────────────────────────────
interface Preferences {
  apiKey: string;
}

// ── Service singletons (dependency injection at module level) ─────
const prefs = getPreferenceValues<Preferences>();
const pageSpeedService = new PageSpeedService(prefs.apiKey);
const historyService = new HistoryService();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ── Entry point ───────────────────────────────────────────────────
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function Command() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [testedUrl, setTestedUrl] = useState<string>("");
  const [strategy, setStrategy] = useState<Strategy>("mobile");

  const resetToForm = () => {
    setMetrics(null);
    setTestedUrl("");
  };

  if (metrics) {
    return (
      <ResultsView
        metrics={metrics}
        url={testedUrl}
        strategy={strategy}
        onBack={resetToForm}
      />
    );
  }

  return (
    <InputForm
      onSubmit={async (url, strat) => {
        setStrategy(strat);
        const result = await runAnalysis(url, strat);
        if (result) {
          setTestedUrl(url);
          setMetrics(result);
        }
      }}
    />
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ── Input Form ────────────────────────────────────────────────────
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface InputFormProps {
  onSubmit: (url: string, strategy: Strategy) => Promise<void>;
}

function InputForm({ onSubmit }: InputFormProps) {
  const [history, setHistory] = useState<string[]>([]);
  const [url, setUrl] = useState<string>("");
  const [strategy, setStrategy] = useState<Strategy>("mobile");

  // Load URL history on mount
  useEffect(() => {
    historyService.getAll().then(setHistory);
  }, []);

  const handleSubmit = async () => {
    const normalizedUrl = Formatter.normalizeUrl(url);

    if (!normalizedUrl) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Please enter a URL",
      });
      return;
    }

    await onSubmit(normalizedUrl, strategy);
  };

  const handleClearHistory = async () => {
    await historyService.clear();
    setHistory([]);
    await showToast({ style: Toast.Style.Success, title: "History cleared" });
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Analyze URL"
            icon={Icon.MagnifyingGlass}
            onSubmit={handleSubmit}
          />
          {history.length > 0 && (
            <Action
              title="Clear History"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              onAction={handleClearHistory}
            />
          )}
          <Action
            title="Change Api Key"
            icon={Icon.Key}
            shortcut={{ modifiers: ["cmd", "shift"], key: "," }}
            onAction={openExtensionPreferences}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="url"
        title="Website URL"
        placeholder="example.com"
        value={url}
        onChange={setUrl}
      />

      <Form.Dropdown
        id="strategy"
        title="Strategy"
        value={strategy}
        onChange={(val) => setStrategy(val as Strategy)}
      >
        <Form.Dropdown.Item value="mobile" title="Mobile" icon={Icon.Mobile} />
        <Form.Dropdown.Item
          value="desktop"
          title="Desktop"
          icon={Icon.Monitor}
        />
      </Form.Dropdown>

      {history.length > 0 && (
        <>
          <Form.Separator />
          <Form.Description
            title="Recent URLs"
            text={history.map((h, i) => `${i + 1}. ${h}`).join("\n")}
          />
        </>
      )}
    </Form>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ── Results View ──────────────────────────────────────────────────
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ResultsViewProps {
  metrics: Metrics;
  url: string;
  strategy: Strategy;
  onBack: () => void;
}

function ResultsView({ metrics, url, strategy, onBack }: ResultsViewProps) {
  const strategyLabel = strategy === "mobile" ? "Mobile" : "Desktop";
  const strategyIcon = strategy === "mobile" ? Icon.Mobile : Icon.Monitor;
  const hostname = Formatter.extractHostname(url);

  // Reusable meta sidebar for every list item
  const Sidebar = React.useMemo(
    () => (
      <List.Item.Detail
        metadata={
          <List.Item.Detail.Metadata>
            <List.Item.Detail.Metadata.Label
              title="Domain"
              text={hostname}
              icon={Icon.Globe}
            />
            <List.Item.Detail.Metadata.Label
              title="Device Form Factor"
              text={strategyLabel}
              icon={strategyIcon}
            />

            <List.Item.Detail.Metadata.Separator />

            {/* Core Scores */}
            <List.Item.Detail.Metadata.TagList title="Performance">
              <List.Item.Detail.Metadata.TagList.Item
                text={metrics.performanceScore.toString()}
                color={Formatter.toScoreColor(metrics.performanceScore)}
              />
            </List.Item.Detail.Metadata.TagList>

            <List.Item.Detail.Metadata.TagList title="Accessibility">
              <List.Item.Detail.Metadata.TagList.Item
                text={metrics.accessibilityScore.toString()}
                color={Formatter.toScoreColor(metrics.accessibilityScore)}
              />
            </List.Item.Detail.Metadata.TagList>

            <List.Item.Detail.Metadata.TagList title="Best Practices">
              <List.Item.Detail.Metadata.TagList.Item
                text={metrics.bestPracticesScore.toString()}
                color={Formatter.toScoreColor(metrics.bestPracticesScore)}
              />
            </List.Item.Detail.Metadata.TagList>

            <List.Item.Detail.Metadata.TagList title="SEO">
              <List.Item.Detail.Metadata.TagList.Item
                text={metrics.seoScore.toString()}
                color={Formatter.toScoreColor(metrics.seoScore)}
              />
            </List.Item.Detail.Metadata.TagList>

            <List.Item.Detail.Metadata.Separator />

            {/* Page Weight summary */}
            <List.Item.Detail.Metadata.Label
              title="Total Requests"
              text={Formatter.toFormattedNumber(metrics.totalRequests)}
              icon={Icon.Download}
            />
            <List.Item.Detail.Metadata.Label
              title="Total Transfer Size"
              text={Formatter.toReadableSize(metrics.totalSizeBytes)}
              icon={Icon.HardDrive}
            />
            <List.Item.Detail.Metadata.Label
              title="DOM Elements"
              text={Formatter.toFormattedNumber(metrics.domSize)}
              icon={Icon.CodeBlock}
            />
            {metrics.renderBlockingCount > 0 && (
              <List.Item.Detail.Metadata.TagList title="Render Blocking">
                <List.Item.Detail.Metadata.TagList.Item
                  text={metrics.renderBlockingCount.toString()}
                  color={Color.Red}
                />
              </List.Item.Detail.Metadata.TagList>
            )}
          </List.Item.Detail.Metadata>
        }
      />
    ),
    [metrics, hostname, strategyLabel, strategyIcon],
  );

  // Actions shared across items
  const ItemsActions = () => (
    <ActionPanel>
      <Action
        title="Test Another URL"
        icon={Icon.ArrowLeft}
        onAction={onBack}
      />
      <Action
        title="Copy Summary to Clipboard"
        icon={Icon.Clipboard}
        onAction={async () => {
          const dump = `Web Metrics: ${url} (${strategyLabel})\nScores: P ${metrics.performanceScore} / A ${metrics.accessibilityScore} / BP ${metrics.bestPracticesScore} / S ${metrics.seoScore}`;
          await Clipboard.copy(dump);
          await showToast({
            style: Toast.Style.Success,
            title: "Summary copied to clipboard",
          });
        }}
      />
      <Action
        title="Change Api Key"
        icon={Icon.Key}
        shortcut={{ modifiers: ["cmd", "shift"], key: "," }}
        onAction={openExtensionPreferences}
      />
    </ActionPanel>
  );

  return (
    <List isShowingDetail navigationTitle={`Metrics for ${hostname}`}>
      {/* ⚡ CORE WEB VITALS SECTION */}
      <List.Section title="Core Web Vitals">
        <List.Item
          title="First Contentful Paint (FCP)"
          icon={Formatter.toMetricIcon("fcp", metrics.fcp)}
          subtitle={Formatter.toReadableTime(metrics.fcp)}
          detail={Sidebar}
          actions={<ItemsActions />}
        />
        <List.Item
          title="Largest Contentful Paint (LCP)"
          icon={Formatter.toMetricIcon("lcp", metrics.lcp)}
          subtitle={Formatter.toReadableTime(metrics.lcp)}
          detail={Sidebar}
          actions={<ItemsActions />}
        />
        <List.Item
          title="Cumulative Layout Shift (CLS)"
          icon={Formatter.toMetricIcon("cls", metrics.cls)}
          subtitle={Formatter.toReadableCls(metrics.cls)}
          detail={Sidebar}
          actions={<ItemsActions />}
        />
        <List.Item
          title="Time to First Byte (TTFB)"
          icon={Formatter.toMetricIcon("ttfb", metrics.ttfb)}
          subtitle={Formatter.toReadableTime(metrics.ttfb)}
          detail={Sidebar}
          actions={<ItemsActions />}
        />
        <List.Item
          title="Time to Interactive (TTI)"
          icon={Formatter.toMetricIcon("tti", metrics.tti)}
          subtitle={Formatter.toReadableTime(metrics.tti)}
          detail={Sidebar}
          actions={<ItemsActions />}
        />
        <List.Item
          title="Total Blocking Time (TBT)"
          icon={Formatter.toMetricIcon("tbt", metrics.tbt)}
          subtitle={Formatter.toReadableTime(metrics.tbt)}
          detail={Sidebar}
          actions={<ItemsActions />}
        />
        <List.Item
          title="Speed Index"
          icon={Formatter.toMetricIcon("speedIndex", metrics.speedIndex)}
          subtitle={Formatter.toReadableTime(metrics.speedIndex)}
          detail={Sidebar}
          actions={<ItemsActions />}
        />
        {metrics.inp > 0 && (
          <List.Item
            title="Interaction to Next Paint (INP)"
            icon={Formatter.toMetricIcon("inp", metrics.inp)}
            subtitle={Formatter.toReadableTime(metrics.inp)}
            detail={Sidebar}
            actions={<ItemsActions />}
          />
        )}
      </List.Section>

      {/* 📦 RESOURCE BREAKDOWN SECTION */}
      {metrics.resourceBreakdown.length > 0 && (
        <List.Section title="Resource Breakdown">
          {metrics.resourceBreakdown.map((r, i) => (
            <List.Item
              key={`res-${i}`}
              title={r.resourceType}
              icon={{ source: Icon.Box, tintColor: Color.PrimaryText }}
              subtitle={`${r.requestCount} Requests`}
              accessories={[{ text: Formatter.toReadableSize(r.transferSize) }]}
              detail={Sidebar}
              actions={<ItemsActions />}
            />
          ))}
        </List.Section>
      )}

      {/* 💡 OPPORTUNITIES SECTION */}
      {metrics.opportunities.length > 0 && (
        <List.Section title="Opportunities">
          {metrics.opportunities.map((o, i) => (
            <List.Item
              key={`opp-${i}`}
              title={o.title}
              icon={{ source: Icon.LightBulb, tintColor: Color.Yellow }}
              subtitle={o.displayValue || undefined}
              detail={Sidebar}
              actions={<ItemsActions />}
            />
          ))}
        </List.Section>
      )}

      {/* 🩺 DIAGNOSTICS SECTION */}
      {metrics.diagnostics.length > 0 && (
        <List.Section title="Diagnostics">
          {metrics.diagnostics.map((d, i) => (
            <List.Item
              key={`diag-${i}`}
              title={d.title}
              icon={{ source: Icon.Info, tintColor: Color.Blue }}
              subtitle={d.displayValue || undefined}
              detail={Sidebar}
              actions={<ItemsActions />}
            />
          ))}
        </List.Section>
      )}
    </List>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ── Orchestration helper ──────────────────────────────────────────
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function runAnalysis(
  url: string,
  strategy: Strategy,
): Promise<Metrics | null> {
  const toast = await showToast({
    style: Toast.Style.Animated,
    title: "Analyzing…",
    message: url,
  });

  try {
    const metrics = await pageSpeedService.fetchMetrics(url, strategy);

    // Persist to history (fire-and-forget is fine here)
    historyService.save(url).catch(() => {
      /* non-critical — silently ignore */
    });

    toast.style = Toast.Style.Success;
    toast.title = "Analysis Complete";
    toast.message = `Score: ${metrics.performanceScore}/100`;

    return metrics;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    toast.style = Toast.Style.Failure;
    toast.title = "Analysis Failed";
    toast.message = message;

    return null;
  }
}
