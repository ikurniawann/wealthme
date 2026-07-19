/* WealthMe UI-kit — Notifikasi screen. */
function ScreenNotifikasi() {
  const DS = window.WealthMeDesignSystem_6818de;
  const { SectionCard, StatusBadge, Button } = DS;
  const { rise, IconChip } = window.WMKit;
  const WM = window.WM;
  const [items, setItems] = React.useState(WM.notif.items);
  const unread = items.filter((i) => i.unread).length;

  return (
    <div style={rise(0)}>
      <SectionCard
        title={
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            Notifikasi{" "}
            {unread > 0 && (
              <StatusBadge variant="danger">{unread} Baru</StatusBadge>
            )}
          </span>
        }
        action={
          <Button
            variant="link"
            size="sm"
            onClick={() =>
              setItems((p) => p.map((i) => ({ ...i, unread: false })))
            }
          >
            Tandai semua dibaca
          </Button>
        }
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {items.map((n, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "14px 0",
                borderTop: i ? "1px solid var(--border)" : "none",
                opacity: n.unread ? 1 : 0.6,
              }}
            >
              <IconChip
                name={n.icon}
                bg={n.bg}
                fg={n.fg}
                size={40}
                iconSize={18}
                radius={12}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{n.title}</div>
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 12.5,
                    color: "var(--muted-foreground)",
                  }}
                >
                  {n.body}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                  }}
                >
                  {n.time}
                </div>
              </div>
              {n.unread && <StatusBadge variant="success">Baru</StatusBadge>}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
window.ScreenNotifikasi = ScreenNotifikasi;
