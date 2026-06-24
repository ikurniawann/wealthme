/* WealthMe UI-kit — Rekonsiliasi Bank screen (4-step wizard). */
const REKON_STEPS = [
  { num: 1, label: "Upload", sub: "Upload dokumen" },
  { num: 2, label: "Pindai", sub: "AI membaca data" },
  { num: 3, label: "Cocokkan", sub: "Samakan transaksi" },
  { num: 4, label: "Selesai", sub: "Simpan hasil" },
];

function ScreenRekonsiliasi() {
  const DS = window.WealthMeDesignSystem_6818de;
  const { SectionCard, Button, StatusBadge } = DS;
  const { rise, panel } = window.WMKit;
  const Icon = window.WMIcon;
  const WM = window.WM;
  const [step, setStep] = React.useState(1);
  const [scanning, setScanning] = React.useState(false);

  const goScan = () => {
    setStep(2);
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setStep(3);
    }, 2200);
  };
  const matched = WM.rekonEntries.filter((e) => e.status === "ok").length;

  const statusColor = {
    ok: "var(--success)",
    warn: "var(--warning)",
    err: "var(--destructive)",
  };
  const statusIcon = { ok: "Check", warn: "TriangleAlert", err: "X" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Stepper */}
      <div style={{ ...panel(), padding: 20, ...rise(0) }}>
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          {REKON_STEPS.map((s, i) => {
            const done = step > s.num,
              active = step === s.num;
            return (
              <React.Fragment key={s.num}>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 700,
                      background: done
                        ? "var(--success)"
                        : active
                          ? "var(--primary)"
                          : "var(--muted)",
                      color:
                        done || active ? "#fff" : "var(--muted-foreground)",
                      boxShadow: active
                        ? "0 0 0 4px color-mix(in oklab, var(--primary) 20%, transparent)"
                        : "none",
                    }}
                  >
                    {done ? (
                      <Icon name="Check" size={18} color="#fff" />
                    ) : (
                      s.num
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      color:
                        active || done
                          ? "var(--foreground)"
                          : "var(--muted-foreground)",
                    }}
                  >
                    {s.label}
                    <span
                      style={{
                        display: "block",
                        fontSize: 10,
                        fontWeight: 400,
                        color: "var(--muted-foreground)",
                      }}
                    >
                      {s.sub}
                    </span>
                  </div>
                </div>
                {i < REKON_STEPS.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      marginTop: 17,
                      background:
                        step > s.num ? "var(--success)" : "var(--border)",
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div style={rise(0.4)}>
          <SectionCard title="Upload Mutasi Rekening">
            <div
              style={{
                fontSize: 12,
                color: "var(--muted-foreground)",
                marginBottom: 14,
              }}
            >
              Format didukung: CSV, PDF, atau XLSX dari bank-bank berikut
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6,1fr)",
                gap: 10,
                marginBottom: 16,
              }}
            >
              {WM.rekonBanks.map((b) => (
                <div
                  key={b.code}
                  style={{
                    height: 44,
                    borderRadius: 10,
                    background: b.bg,
                    color: b.color,
                    fontSize: 12,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {b.code}
                </div>
              ))}
            </div>
            <button
              onClick={goScan}
              style={{
                width: "100%",
                borderRadius: 12,
                border: "1.5px dashed var(--primary)",
                background: "var(--accent)",
                padding: "32px 16px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Icon name="CloudUpload" size={32} color="var(--primary)" />
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--foreground)",
                }}
              >
                Tarik & lepas file mutasi, atau klik untuk pilih
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>
                CSV / PDF / XLSX · maks 10MB
              </div>
            </button>
          </SectionCard>
        </div>
      )}

      {/* Step 2: Scanning */}
      {step === 2 && (
        <div style={rise(0.4)}>
          <SectionCard title="AI Sedang Memindai">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
                padding: "40px 16px",
              }}
            >
              <div
                className="gradient-ai"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  animation: "wm-pop .6s ease both",
                }}
              >
                <Icon name="Bot" size={30} color="#fff" />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                Membaca {WM.rekonEntries.length} baris transaksi…
              </div>
              <div
                style={{
                  width: 240,
                  height: 6,
                  borderRadius: 999,
                  background: "var(--muted)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: scanning ? "100%" : "0%",
                    background: "var(--primary)",
                    borderRadius: 999,
                    transition: "width 2s linear",
                  }}
                />
              </div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                Mencocokkan otomatis dengan transaksimu…
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Step 3: Match */}
      {step === 3 && (
        <div style={rise(0.4)}>
          <SectionCard
            title={`Hasil Pencocokan · ${matched}/${WM.rekonEntries.length} cocok otomatis`}
            action={
              <Button variant="link" size="sm" onClick={() => setStep(4)}>
                Simpan →
              </Button>
            }
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              {WM.rekonEntries.map((e, i) => (
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
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: statusColor[e.status],
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon
                      name={statusIcon[e.status]}
                      size={13}
                      color="#fff"
                      stroke={3}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="mono"
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {e.desc}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "var(--muted-foreground)" }}
                    >
                      {e.date} · {e.match}
                    </div>
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: e.amt > 0 ? "var(--success)" : "var(--foreground)",
                    }}
                  >
                    {(e.amt > 0 ? "+" : "−") + WM.formatRupiah(Math.abs(e.amt))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 4 && (
        <div style={rise(0.4)}>
          <SectionCard title="Rekonsiliasi Selesai">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                padding: "40px 16px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "var(--success-soft)",
                  color: "var(--success)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  animation: "wm-pop .6s ease both",
                }}
              >
                <Icon name="CircleCheck" size={34} color="var(--success)" />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {matched} transaksi berhasil direkonsiliasi
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--muted-foreground)",
                  maxWidth: 360,
                }}
              >
                Catatan keuanganmu kini sinkron dengan mutasi bank. Entri yang
                belum cocok bisa ditinjau manual kapan saja.
              </div>
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                iconStart={<Icon name="RotateCw" size={14} />}
              >
                Rekonsiliasi Lagi
              </Button>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
window.ScreenRekonsiliasi = ScreenRekonsiliasi;
