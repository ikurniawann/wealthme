"use client";

import { AlertTriangle } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

type ChartErrorProps = {
  /** Short label naming which chart failed, e.g. "Grafik arus kas". */
  label?: string;
  className?: string;
};

/**
 * Labeled fallback card for a chart that failed to render. Ported from the
 * prototype's `.chart-error` block (docs/prototype/assets/charts.js's
 * mount() catch handler) so a broken Apex mount degrades to something
 * visible instead of silent blank space.
 */
export function ChartError({ label, className }: ChartErrorProps) {
  return (
    <div
      role="alert"
      className={`flex min-h-[120px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-4 text-center ${className ?? ""}`}
    >
      <AlertTriangle aria-hidden="true" className="size-4 text-destructive" />
      <strong className="text-xs font-semibold text-foreground">
        {label
          ? `${label} belum dapat ditampilkan.`
          : "Grafik belum dapat ditampilkan."}
      </strong>
      <span className="text-[11px] text-muted-foreground">
        Muat ulang halaman untuk mencoba lagi.
      </span>
    </div>
  );
}

type ChartErrorBoundaryProps = {
  children: ReactNode;
  /** Passed through to the fallback's label. */
  label?: string;
};

type ChartErrorBoundaryState = { hasError: boolean };

/**
 * Catches a failed ApexCharts render (a throw during mount/construction, or
 * bad option/series shapes) and degrades to `<ChartError />` instead of an
 * uncaught exception taking down the page. React error boundaries must be
 * class components — there is no hook equivalent.
 */
export class ChartErrorBoundary extends Component<
  ChartErrorBoundaryProps,
  ChartErrorBoundaryState
> {
  state: ChartErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ChartErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Logged to the browser console only — no error-tracking sink (e.g. Sentry)
    // is wired up yet. The user only sees the fallback card.
    // TODO: forward to an error-tracking sink once one is configured for apps/web.
    console.error(
      "[ChartErrorBoundary] chart render failed",
      error,
      info.componentStack,
    );
  }

  render() {
    if (this.state.hasError) {
      return <ChartError label={this.props.label} />;
    }
    return this.props.children;
  }
}
