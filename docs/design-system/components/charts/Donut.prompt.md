**Donut + DonutLegend** — wealth allocation ring with a centered total and a percentage legend. Use the `chart-1…5` tokens for segment colors.

```jsx
const segs = [
  { label: "Investasi", value: 45, color: "var(--chart-1)", sub: "Rp 1,2 M" },
  { label: "Properti",  value: 30, color: "var(--chart-2)", sub: "Rp 820 jt" },
  { label: "Kas",       value: 25, color: "var(--chart-3)", sub: "Rp 410 jt" },
];
<Donut segments={segs} centerValue="Rp 2,4 M" centerLabel="Total" />
<DonutLegend segments={segs} />
```
