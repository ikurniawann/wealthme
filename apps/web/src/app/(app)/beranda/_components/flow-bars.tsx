"use client";

import type { FlowDay } from "@/components/charts/bento-charts";

/**
 * Diverging daily cash-flow bars for the Beranda hero: income rises above a
 * shared zero line, expense hangs below it. Replaces the two-series
 * streamgraph, whose overlapping silhouettes read as unlabeled blobs and
 * could not answer the hero's only question — "did more come in than went
 * out, and on which days?".
 *
 * Pure flex layout sized by percentages of its container: no measurement,
 * so it cannot feed back into the hero's height (the ResizeObserver loop
 * that once blanked this card).
 */
export function FlowBars({
  days,
  format,
  formatFull,
  axis,
  labels,
  ariaLabel,
}: {
  days: FlowDay[];
  format: (value: number) => string;
  formatFull: (value: number) => string;
  /** Short value-axis tick ("€ 2,4 rb"); defaults to `format`. */
  axis?: (value: number) => string;
  labels: { income: string; expense: string };
  ariaLabel: string;
}) {
  const tick = axis ?? format;
  const maxIn = Math.max(0, ...days.map((day) => day.income));
  const maxOut = Math.max(0, ...days.map((day) => day.expense));
  const total = maxIn + maxOut;
  // Each side gets room in proportion to its own peak, so a quiet income
  // week does not squash the expense bars (and vice versa).
  const upShare =
    total > 0 ? Math.max(0.25, Math.min(0.75, maxIn / total)) : 0.5;

  return (
    <div className="flow-bars">
      <div className="flow-bars-plot">
        <div className="flow-bars-axis" aria-hidden="true">
          <span style={{ top: 0 }}>{maxIn > 0 ? tick(maxIn) : ""}</span>
          <span data-zero style={{ top: `${upShare * 100}%` }}>
            0
          </span>
          <span style={{ bottom: 0 }}>{maxOut > 0 ? tick(-maxOut) : ""}</span>
        </div>
        <div className="flow-bars-cols">
          <div
            className="flow-bars-zero"
            style={{ top: `${upShare * 100}%` }}
            aria-hidden="true"
          />
          {days.map((day, index) => (
            <div
              key={index}
              className="flow-bars-col"
              title={`${day.label}\n${labels.income}: ${formatFull(day.income)}\n${labels.expense}: ${formatFull(day.expense)}`}
            >
              <div
                className="flow-bars-up"
                style={{ height: `${upShare * 100}%` }}
              >
                {day.income > 0 && (
                  <i
                    data-kind="income"
                    style={{ height: `${(day.income / maxIn) * 100}%` }}
                  />
                )}
              </div>
              <div
                className="flow-bars-down"
                style={{ height: `${(1 - upShare) * 100}%` }}
              >
                {day.expense > 0 && (
                  <i
                    data-kind="expense"
                    style={{ height: `${(day.expense / maxOut) * 100}%` }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flow-bars-x" aria-hidden="true">
        {days.map((day, index) => (
          <span key={index}>{day.label}</span>
        ))}
      </div>
      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">{labels.income}</th>
              <th scope="col">{labels.expense}</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day, index) => (
              <tr key={index}>
                <th scope="row">{day.label || index + 1}</th>
                <td>{formatFull(day.income)}</td>
                <td>{formatFull(day.expense)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
