**Button** — the brand's primary action control; use `default` (indigo) for the main action on a view, `outline`/`secondary`/`ghost` for secondary actions, and `destructive` for deletes.

```jsx
<Button variant="default" size="default" iconStart={<Plus size={14} />}>
  Tambah Transaksi
</Button>
```

Variants: `default` · `outline` · `secondary` · `ghost` · `destructive` · `link`.
Sizes: `sm` (28px) · `default` (34px) · `lg` (40px) · `icon` (square 36px).
Pass `iconStart` / `iconEnd` for Lucide icons. Hover lightens the fill; press nudges 1px down.
