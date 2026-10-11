import styles from "./grouped-bars.module.css";

export type GroupedBarSeries = { name: string; data: number[]; color: string };

/**
 * Side-by-side (or stacked) bars for two or more series. Positive values rise
 * from the zero line, negative values hang below it, so a net/deficit series
 * stays honest. Hover a column for exact values; screen readers get the full
 * table.
 */
export function GroupedBars({
  labels,
  series,
  stacked = false,
  legend = true,
  format,
  formatFull,
  axis,
  ariaLabel,
}: {
  labels: string[];
  series: GroupedBarSeries[];
  stacked?: boolean;
  legend?: boolean;
  format: (value: number) => string;
  formatFull: (value: number) => string;
  /** Short tick formatter for the value axis; defaults to `format`. */
  axis?: (value: number) => string;
  ariaLabel: string;
}) {
  const tick = axis ?? format;
  const value = (s: GroupedBarSeries, i: number) => s.data[i] ?? 0;
  const maxPos = Math.max(
    0,
    ...(stacked
      ? labels.map((_, i) =>
          series.reduce((sum, s) => sum + Math.max(0, value(s, i)), 0),
        )
      : series.flatMap((s) => labels.map((_, i) => value(s, i)))),
  );
  const maxNeg = stacked
    ? 0
    : Math.max(0, ...series.flatMap((s) => labels.map((_, i) => -value(s, i))));
  const total = maxPos + maxNeg;
  const up = total > 0 ? maxPos / total : 1;
  const pct = (v: number, max: number) =>
    max > 0 ? `${(v / max) * 100}%` : "0";

  return (
    <div className={styles.root}>
      {legend && (
        <div className={styles.legend} aria-hidden="true">
          {series.map((s) => (
            <span key={s.name}>
              <i style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <div className={styles.plot}>
        <div className={styles.axis} aria-hidden="true">
          {maxPos > 0 && <span style={{ top: 0 }}>{tick(maxPos)}</span>}
          <span data-zero style={{ top: `${up * 100}%` }}>
            0
          </span>
          {maxNeg > 0 && <span style={{ bottom: 0 }}>{tick(-maxNeg)}</span>}
        </div>
        <div className={styles.cols}>
          <div
            className={styles.zero}
            style={{ top: `${up * 100}%` }}
            aria-hidden="true"
          />
          {labels.map((label, i) => (
            <div
              key={i}
              className={styles.group}
              title={[
                label,
                ...series.map((s) => `${s.name}: ${formatFull(value(s, i))}`),
              ].join("\n")}
            >
              <div className={styles.up} style={{ height: `${up * 100}%` }}>
                {stacked ? (
                  <div className={styles.stack}>
                    {series.map((s) =>
                      value(s, i) > 0 ? (
                        <i
                          key={s.name}
                          style={{
                            height: pct(value(s, i), maxPos),
                            background: s.color,
                          }}
                        />
                      ) : null,
                    )}
                  </div>
                ) : (
                  series.map((s) => (
                    <i
                      key={s.name}
                      style={{
                        height: pct(Math.max(0, value(s, i)), maxPos),
                        background: s.color,
                      }}
                    />
                  ))
                )}
              </div>
              {maxNeg > 0 && (
                <div
                  className={styles.down}
                  style={{ height: `${(1 - up) * 100}%` }}
                >
                  {series.map((s) => (
                    <i
                      key={s.name}
                      style={{
                        height: pct(Math.max(0, -value(s, i)), maxNeg),
                        background: s.color,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.x} aria-hidden="true">
        {labels.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col" />
              {series.map((s) => (
                <th key={s.name} scope="col">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, i) => (
              <tr key={i}>
                <th scope="row">{label || i + 1}</th>
                {series.map((s) => (
                  <td key={s.name}>{formatFull(value(s, i))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
