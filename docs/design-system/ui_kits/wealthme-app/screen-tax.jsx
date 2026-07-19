/* WealthMe UI-kit — Tax Center screen (live PPh 21 progressive calculator). */
function ScreenTax() {
  const DS = window.WealthMeDesignSystem_6818de;
  const { HeroCard, SectionCard, Button } = DS;
  const { rise, IconChip, panel } = window.WMKit;
  const Icon = window.WMIcon;
  const WM = window.WM;
  const T = WM.tax;
  const [gross, setGross] = React.useState(T.calc.gross);
  const [ptkp, setPtkp] = React.useState(T.calc.ptkp);
  const [zakat, setZakat] = React.useState(T.calc.zakat);

  const BRACKETS = [
    [60e6, 0.05],
    [190e6, 0.15],
    [250e6, 0.25],
    [4.5e9, 0.3],
    [Infinity, 0.35],
  ];
  const ROWS = [
    { label: "0 – 60 jt", rate: "5%", idx: 0 },
    { label: "60 – 250 jt", rate: "15%", idx: 1 },
    { label: "250 – 500 jt", rate: "25%", idx: 2 },
    { label: "> 5 M", rate: "35%", idx: 4 },
  ];
  const jabatan = Math.min(gross * 0.05, 6e6);
  let pkp = Math.max(0, gross - jabatan - ptkp - zakat);
  pkp = Math.floor(pkp / 1000) * 1000;
  const layer = new Array(BRACKETS.length).fill(0);
  let tax = 0,
    sisa = pkp;
  for (let i = 0; i < BRACKETS.length; i++) {
    if (sisa <= 0) break;
    const ken = Math.min(sisa, BRACKETS[i][0]);
    layer[i] = ken * BRACKETS[i][1];
    tax += layer[i];
    sisa -= ken;
  }
  tax = Math.round(tax);
  const effRate =
    gross > 0 ? ((tax / gross) * 100).toFixed(1).replace(".", ",") + "%" : "0%";

  const numField = (label, value, setter, disabled) => (
    <div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--muted-foreground)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <input
        type="text"
        value={value.toLocaleString("id-ID")}
        disabled={disabled}
        onChange={(e) =>
          setter && setter(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)
        }
        className="mono"
        style={{
          width: "100%",
          height: 38,
          padding: "0 12px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--input)",
          background: "var(--card)",
          color: "var(--foreground)",
          fontSize: 13,
          outline: "none",
          opacity: disabled ? 0.7 : 1,
        }}
      />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={rise(0)}>
        <HeroCard gradient="gradient-wealth">
          <div
            style={{
              fontSize: 12,
              opacity: 0.85,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Icon name="FileText" size={14} color="#fff" /> Estimasi Pajak
            Terutang {T.year}
          </div>
          <div
            className="mono"
            style={{
              fontSize: 30,
              fontWeight: 900,
              letterSpacing: "-1px",
              marginTop: 4,
            }}
          >
            {WM.formatRupiah(tax)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
            PPh 21 · Status: WP Orang Pribadi
          </div>
        </HeroCard>
      </div>

      {/* SPT status */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 14,
        }}
      >
        {[
          {
            label: `Status SPT Tahunan ${T.year - 1}`,
            val: "✅ Sudah Lapor",
            color: "var(--success)",
            sub: "NTTE 123456789",
          },
          {
            label: `SPT ${T.year}`,
            val: "⏳ Belum Lapor",
            color: "var(--warning)",
            sub: `Deadline 31 Mar ${T.year + 1}`,
          },
          {
            label: "Zakat Pengurang Pajak",
            val: WM.formatCompact(zakat),
            color: "var(--primary)",
            sub: "dari donasi tercatat",
          },
        ].map((c, i) => (
          <div
            key={i}
            style={{ ...panel(), padding: 16, ...rise(0.4 + i * 0.2) }}
          >
            <div
              style={{
                fontSize: 10.5,
                color: "var(--muted-foreground)",
                marginBottom: 4,
              }}
            >
              {c.label}
            </div>
            <div
              className="mono"
              style={{ fontSize: 16, fontWeight: 800, color: c.color }}
            >
              {c.val}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>
              {c.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Calculator */}
      <div style={rise(1)}>
        <SectionCard title="🧮 Kalkulator PPh 21 (Pribadi)">
          <div
            style={{
              fontSize: 12,
              color: "var(--muted-foreground)",
              marginBottom: 14,
            }}
          >
            Hitung estimasi pajak penghasilan berdasarkan tarif progresif UU HPP
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            {numField("Penghasilan Bruto/Tahun (Rp)", gross, setGross)}
            <div>
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--muted-foreground)",
                  marginBottom: 6,
                }}
              >
                Status (PTKP)
              </div>
              <select
                value={ptkp}
                onChange={(e) => setPtkp(Number(e.target.value))}
                style={{
                  width: "100%",
                  height: 38,
                  padding: "0 12px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--input)",
                  background: "var(--card)",
                  color: "var(--foreground)",
                  fontSize: 13,
                  outline: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                }}
              >
                {T.ptkpOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {numField(
              "Biaya Jabatan (otomatis)",
              Math.round(jabatan),
              null,
              true,
            )}
            {numField("Zakat/Donasi (pengurang)", zakat, setZakat)}
          </div>
          <div
            style={{
              marginTop: 16,
              borderRadius: 12,
              border:
                "1px solid color-mix(in oklab, var(--primary) 15%, transparent)",
              background: "var(--accent)",
              padding: 16,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>
              Estimasi PPh 21 Terutang/Tahun
            </div>
            <div
              className="mono"
              style={{
                marginTop: 4,
                fontSize: 24,
                fontWeight: 900,
                color: "var(--primary)",
              }}
            >
              {WM.formatRupiah(tax)}
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                color: "var(--muted-foreground)",
              }}
            >
              PKP:{" "}
              <strong style={{ color: "var(--primary)" }}>
                {WM.formatRupiah(pkp)}
              </strong>{" "}
              · Efektif <strong>{effRate}</strong>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Progressive breakdown */}
      <div style={rise(1.4)}>
        <SectionCard title="Rincian Tarif Progresif (UU HPP)">
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "var(--font-sans)",
              fontSize: 12.5,
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border)",
                  color: "var(--muted-foreground)",
                  fontSize: 11,
                }}
              >
                <th
                  style={{
                    textAlign: "left",
                    padding: "8px 0",
                    fontWeight: 600,
                  }}
                >
                  Lapisan PKP
                </th>
                <th
                  style={{
                    textAlign: "center",
                    padding: "8px 0",
                    fontWeight: 600,
                  }}
                >
                  Tarif
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "8px 0",
                    fontWeight: 600,
                  }}
                >
                  Pajak
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => {
                const t = layer[r.idx];
                const muted = t <= 0;
                const c = muted
                  ? "var(--muted-foreground)"
                  : "var(--foreground)";
                return (
                  <tr
                    key={r.label}
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <td style={{ padding: "9px 0", color: c }}>{r.label}</td>
                    <td
                      style={{
                        padding: "9px 0",
                        textAlign: "center",
                        color: c,
                      }}
                    >
                      {r.rate}
                    </td>
                    <td
                      className="mono"
                      style={{ padding: "9px 0", textAlign: "right", color: c }}
                    >
                      {WM.formatRupiah(Math.round(t))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </SectionCard>
      </div>

      {/* Docs */}
      <div style={rise(1.8)}>
        <SectionCard
          title="Dokumen Pajak"
          action={
            <Button variant="link" size="sm">
              + Upload
            </Button>
          }
        >
          {T.docs.map((d, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 0",
                borderTop: i ? "1px solid var(--border)" : "none",
              }}
            >
              <IconChip
                name={d.icon}
                bg={d.bg}
                fg={d.fg}
                size={34}
                iconSize={16}
                radius={9}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{d.name}</div>
                <div
                  style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}
                >
                  {d.meta}
                </div>
              </div>
              <Icon name="Download" size={16} color="var(--primary)" />
            </div>
          ))}
        </SectionCard>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Button
          size="lg"
          style={{ flex: 1 }}
          iconStart={<Icon name="Send" size={15} color="#fff" />}
        >
          Lapor SPT Tahunan
        </Button>
        <Button
          size="lg"
          variant="outline"
          style={{ flex: 1 }}
          iconStart={<Icon name="FileText" size={15} />}
        >
          Unduh Ringkasan
        </Button>
      </div>
    </div>
  );
}
window.ScreenTax = ScreenTax;
