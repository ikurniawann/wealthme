/* WealthMe UI-kit — Akun (account & settings) screen. */
function ScreenAkun({ onLogout }) {
  const DS = window.WealthMeDesignSystem_6818de;
  const { SectionCard, StatusBadge } = DS;
  const { rise, IconChip } = window.WMKit;
  const Icon = window.WMIcon;
  const WM = window.WM;

  const MenuRow = ({ r, last }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 0",
        borderBottom: last ? "none" : "1px solid var(--border)",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
    >
      <IconChip
        name={r.icon}
        bg={r.bg}
        fg={r.fg}
        size={36}
        iconSize={16}
        radius={10}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.name}</div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          {r.sub}
        </div>
      </div>
      {r.right && (
        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          {r.right}
        </span>
      )}
      <Icon name="ChevronRight" size={16} color="var(--muted-foreground)" />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Profile hero */}
      <div
        className="gradient-profile"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          borderRadius: 18,
          padding: 20,
          color: "#fff",
          ...rise(0),
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "rgba(255,255,255,.2)",
            fontSize: 22,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {WM.user.initials}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{WM.user.name}</div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>{WM.user.email}</div>
          <div style={{ marginTop: 2, fontSize: 12, opacity: 0.75 }}>
            Member sejak Januari 2024
          </div>
        </div>
      </div>

      {/* Family group */}
      <div
        style={{
          background: "var(--card)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--ring-card)",
          padding: 16,
          ...rise(0.4),
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
          👨‍👩‍👧‍👦 Group Family
        </div>
        <button
          style={{
            width: "100%",
            borderRadius: 12,
            border: "1.5px solid var(--border)",
            background: "transparent",
            padding: 14,
            textAlign: "left",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.borderColor = "var(--primary)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = "var(--border)")
          }
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              background: "var(--accent)",
              fontSize: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            👨‍👩‍👧‍👦
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {WM.family.name}{" "}
              <StatusBadge variant="info">{WM.family.role}</StatusBadge>
            </div>
            <div
              style={{
                marginTop: 2,
                fontSize: 11.5,
                color: "var(--muted-foreground)",
              }}
            >
              {WM.family.members} anggota
            </div>
          </div>
          <Icon name="ChevronRight" size={16} color="var(--muted-foreground)" />
        </button>
      </div>

      {WM.akunMenu.map((sec, si) => (
        <div key={sec.section} style={rise(0.8 + si * 0.3)}>
          <SectionCard title={sec.section}>
            {sec.rows.map((r, i) => (
              <MenuRow key={r.name} r={r} last={i === sec.rows.length - 1} />
            ))}
          </SectionCard>
        </div>
      ))}

      <button
        onClick={onLogout}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          borderRadius: 10,
          border: "1.5px solid #FECACA",
          background: "var(--background)",
          padding: "12px",
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--destructive)",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          ...rise(1.8),
        }}
      >
        <Icon name="LogOut" size={16} color="var(--destructive)" /> Keluar dari
        Akun
      </button>
    </div>
  );
}
window.ScreenAkun = ScreenAkun;
