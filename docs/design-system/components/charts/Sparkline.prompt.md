**Sparkline** — smoothed canvas trend line. Defaults are tuned for the white-on-indigo hero card; override `stroke`/`fill` on light surfaces.

```jsx
<Sparkline points={[40,42,38,45,50,48,55,60]} />
<Sparkline points={data} stroke="var(--primary)" fill="rgba(79,70,229,0.18)" />
```
