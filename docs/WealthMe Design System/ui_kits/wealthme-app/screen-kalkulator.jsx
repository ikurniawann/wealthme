/* WealthMe UI-kit — Kalkulator (7 live financial calculators). */
const KAL_TABS = [
  { key: "zakat", label: "🌙 Zakat Maal" },
  { key: "pph21", label: "🧾 PPh 21" },
  { key: "investasi", label: "📈 Investasi" },
  { key: "kredit", label: "💳 Kredit" },
  { key: "pensiun", label: "🏖️ Pensiun" },
  { key: "tabungan", label: "🏦 Tabungan" },
  { key: "splitgroup", label: "🧾 Split Group" },
];
const KAL_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Ags",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function KalField({ label, value, set, num, disabled }) {
  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
        {label}
      </div>
      <input
        type="text"
        disabled={disabled}
        value={num ? value : value.toLocaleString("id-ID")}
        onChange={(e) =>
          set &&
          set(
            num
              ? e.target.value.replace(/[^\d.]/g, "")
              : parseInt(e.target.value.replace(/\D/g, ""), 10) || 0,
          )
        }
        className={num ? "" : "mono"}
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
          fontFamily: "var(--font-sans)",
        }}
      />
    </div>
  );
}
function KalResult({ label, value, detail }) {
  return (
    <div
      style={{
        marginTop: 16,
        borderRadius: 14,
        border:
          "1px solid color-mix(in oklab, var(--primary) 30%, transparent)",
        background: "var(--accent)",
        padding: 18,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
        {label}
      </div>
      <div
        className="mono"
        style={{
          marginTop: 2,
          fontSize: 26,
          fontWeight: 900,
          color: "var(--primary-strong)",
        }}
      >
        {value}
      </div>
      <div
        style={{ marginTop: 6, fontSize: 12, color: "var(--muted-foreground)" }}
      >
        {detail}
      </div>
    </div>
  );
}

function ScreenKalkulator() {
  const DS = window.WealthMeDesignSystem_6818de;
  const { SectionCard } = DS;
  const WM = window.WM;
  const fmt = WM.formatRupiah;
  const [tab, setTab] = React.useState("investasi");

  // state for every calculator (hooks must be unconditional)
  const [zk, setZk] = React.useState({
    cash: 50000000,
    invest: 30000000,
    gold: 0,
    liab: 0,
  });
  const [pph, setPph] = React.useState({ gross: 120000000, zakat: 0 });
  const [inv, setInv] = React.useState({
    modal: 50000000,
    monthly: 2000000,
    rate: "12",
    years: "10",
  });
  const [kr, setKr] = React.useState({
    pinjaman: 500000000,
    bunga: "7",
    tenor: "20",
    dp: "20",
  });
  const [pn, setPn] = React.useState({
    now: "30",
    retire: "55",
    monthly: 10000000,
    ret: "10",
  });
  const [tb, setTb] = React.useState({
    target: 100000000,
    current: 10000000,
    bunga: "4",
    setor: 3000000,
  });
  const [sg, setSg] = React.useState({
    total: 1250000,
    people: "5",
    tax: "10",
    tip: "0",
  });
  const u = (set) => (k) => (v) => set((s) => ({ ...s, [k]: v }));

  const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 };

  // computations
  const nisab = 93500000,
    zakatable = zk.cash + zk.invest + zk.gold - zk.liab;
  const zakat = zakatable >= nisab ? Math.round(zakatable * 0.025) : 0;

  const pphJab = Math.min(pph.gross * 0.05, 6000000);
  let pphPkp = Math.max(0, pph.gross - pphJab - 54000000 - pph.zakat);
  pphPkp = Math.floor(pphPkp / 1000) * 1000;
  const PB = [
    [60e6, 0.05],
    [190e6, 0.15],
    [250e6, 0.25],
    [4.5e9, 0.3],
    [Infinity, 0.35],
  ];
  let pphTax = 0,
    ps = pphPkp;
  for (const [lim, r] of PB) {
    if (ps <= 0) break;
    const ken = Math.min(ps, lim);
    pphTax += ken * r;
    ps -= ken;
  }
  pphTax = Math.round(pphTax);

  const ir = Number(inv.rate) / 100 / 12,
    iN = Number(inv.years) * 12,
    iF = Math.pow(1 + ir, iN);
  const iFv =
    ir === 0
      ? inv.modal + inv.monthly * iN
      : inv.modal * iF + (inv.monthly * (iF - 1)) / ir;
  const iTot = inv.modal + inv.monthly * iN;

  const kPokok = kr.pinjaman * (1 - Number(kr.dp) / 100),
    kr_ = Number(kr.bunga) / 100 / 12,
    kN = Number(kr.tenor) * 12,
    kF = Math.pow(1 + kr_, kN);
  const kCic = kr_ === 0 ? kPokok / kN : (kPokok * kr_ * kF) / (kF - 1);

  const pNeeded = pn.monthly * 12 * 20,
    pr = Number(pn.ret) / 100 / 12,
    pN = (Number(pn.retire) - Number(pn.now)) * 12,
    pF = Math.pow(1 + pr, pN);
  const pPmt =
    pN <= 0 ? 0 : pr === 0 ? pNeeded / pN : (pNeeded * pr * pF) / (pF - 1);

  let tbSaldo = tb.current,
    tbM = 0,
    tbR = Number(tb.bunga) / 100 / 12;
  while (tbSaldo < tb.target && tbM < 600) {
    tbSaldo = tbSaldo * (1 + tbR) + tb.setor;
    tbM++;
  }
  const tbDate = new Date();
  tbDate.setMonth(tbDate.getMonth() + tbM);

  const sgP = Math.max(1, Number(sg.people) || 1),
    sgGrand =
      sg.total +
      (sg.total * Number(sg.tax)) / 100 +
      (sg.total * Number(sg.tip)) / 100;
  const sgPer = Math.round(sgGrand / sgP);
  const NAMES = [
    "Andi",
    "Budi",
    "Citra",
    "Dani",
    "Eka",
    "Fani",
    "Gilang",
    "Hana",
    "Indra",
    "Joko",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{ display: "flex", gap: 8, overflowX: "auto" }}
        className="hide-scrollbar"
      >
        {KAL_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flexShrink: 0,
              borderRadius: 999,
              padding: "8px 14px",
              fontSize: 12.5,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontFamily: "var(--font-sans)",
              background: tab === t.key ? "var(--primary)" : "var(--secondary)",
              color: tab === t.key ? "#fff" : "var(--muted-foreground)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "zakat" && (
        <SectionCard title="Kalkulator Zakat Maal">
          <div
            style={{
              fontSize: 12,
              color: "var(--muted-foreground)",
              marginBottom: 14,
            }}
          >
            Nisab = 85g emas × Rp 1.100.000 ={" "}
            <strong style={{ color: "var(--foreground)" }}>
              Rp 93.500.000
            </strong>
          </div>
          <div style={grid}>
            <KalField
              label="Kas & Tabungan (Rp)"
              value={zk.cash}
              set={u(setZk)("cash")}
            />
            <KalField
              label="Investasi (Rp)"
              value={zk.invest}
              set={u(setZk)("invest")}
            />
            <KalField
              label="Nilai Emas (Rp)"
              value={zk.gold}
              set={u(setZk)("gold")}
            />
            <KalField
              label="Hutang / Liabilitas (Rp)"
              value={zk.liab}
              set={u(setZk)("liab")}
            />
          </div>
          <KalResult
            label={zakat > 0 ? "Zakat yang Wajib Dibayar" : "Belum Wajib Zakat"}
            value={fmt(zakat)}
            detail={
              <>
                Harta zakatable:{" "}
                <strong style={{ color: "var(--foreground)" }}>
                  {fmt(zakatable)}
                </strong>{" "}
                · Nisab:{" "}
                <strong style={{ color: "var(--foreground)" }}>
                  {fmt(nisab)}
                </strong>
              </>
            }
          />
        </SectionCard>
      )}
      {tab === "pph21" && (
        <SectionCard title="Kalkulator PPh 21 (UU HPP)">
          <div
            style={{
              fontSize: 12,
              color: "var(--muted-foreground)",
              marginBottom: 14,
            }}
          >
            PTKP TK/0: Rp 54.000.000 · Biaya jabatan: 5% maks Rp 6.000.000
          </div>
          <div style={grid}>
            <KalField
              label="Penghasilan Bruto / Tahun (Rp)"
              value={pph.gross}
              set={u(setPph)("gross")}
            />
            <KalField
              label="Zakat yang Dibayar (Rp)"
              value={pph.zakat}
              set={u(setPph)("zakat")}
            />
          </div>
          <KalResult
            label="Total PPh 21 Terutang / Tahun"
            value={fmt(pphTax)}
            detail={
              <>
                PKP:{" "}
                <strong style={{ color: "var(--foreground)" }}>
                  {fmt(pphPkp)}
                </strong>{" "}
                · Efektif{" "}
                <strong style={{ color: "var(--primary)" }}>
                  {pph.gross > 0 ? ((pphTax / pph.gross) * 100).toFixed(2) : 0}%
                </strong>
              </>
            }
          />
        </SectionCard>
      )}
      {tab === "investasi" && (
        <SectionCard title="Kalkulator Investasi">
          <div style={grid}>
            <KalField
              label="Modal Awal (Rp)"
              value={inv.modal}
              set={u(setInv)("modal")}
            />
            <KalField
              label="Setoran Bulanan (Rp)"
              value={inv.monthly}
              set={u(setInv)("monthly")}
            />
            <KalField
              label="Return per Tahun (%)"
              value={inv.rate}
              set={u(setInv)("rate")}
              num
            />
            <KalField
              label="Jangka Waktu (Tahun)"
              value={inv.years}
              set={u(setInv)("years")}
              num
            />
          </div>
          <KalResult
            label="Estimasi Nilai Akhir"
            value={fmt(iFv)}
            detail={
              <>
                Modal total:{" "}
                <strong style={{ color: "var(--foreground)" }}>
                  {fmt(iTot)}
                </strong>{" "}
                · Keuntungan:{" "}
                <strong style={{ color: "var(--success)" }}>
                  {fmt(iFv - iTot)}
                </strong>
              </>
            }
          />
        </SectionCard>
      )}
      {tab === "kredit" && (
        <SectionCard title="Kalkulator Kredit / KPR">
          <div style={grid}>
            <KalField
              label="Jumlah Pinjaman (Rp)"
              value={kr.pinjaman}
              set={u(setKr)("pinjaman")}
            />
            <KalField
              label="Bunga per Tahun (%)"
              value={kr.bunga}
              set={u(setKr)("bunga")}
              num
            />
            <KalField
              label="Tenor (Tahun)"
              value={kr.tenor}
              set={u(setKr)("tenor")}
              num
            />
            <KalField label="DP (%)" value={kr.dp} set={u(setKr)("dp")} num />
          </div>
          <KalResult
            label="Cicilan per Bulan"
            value={fmt(kCic)}
            detail={
              <>
                Pokok pinjaman:{" "}
                <strong style={{ color: "var(--foreground)" }}>
                  {fmt(kPokok)}
                </strong>{" "}
                · Total bayar:{" "}
                <strong style={{ color: "var(--destructive)" }}>
                  {fmt(kCic * kN)}
                </strong>
              </>
            }
          />
        </SectionCard>
      )}
      {tab === "pensiun" && (
        <SectionCard title="Kalkulator Dana Pensiun">
          <div style={grid}>
            <KalField
              label="Usia Sekarang"
              value={pn.now}
              set={u(setPn)("now")}
              num
            />
            <KalField
              label="Target Usia Pensiun"
              value={pn.retire}
              set={u(setPn)("retire")}
              num
            />
            <KalField
              label="Pengeluaran / Bulan (Rp)"
              value={pn.monthly}
              set={u(setPn)("monthly")}
            />
            <KalField
              label="Return Investasi (%/thn)"
              value={pn.ret}
              set={u(setPn)("ret")}
              num
            />
          </div>
          <KalResult
            label="Dana Pensiun yang Dibutuhkan"
            value={fmt(pNeeded)}
            detail={
              <>
                Investasi bulanan yang dibutuhkan:{" "}
                <strong style={{ color: "var(--primary)" }}>{fmt(pPmt)}</strong>
              </>
            }
          />
        </SectionCard>
      )}
      {tab === "tabungan" && (
        <SectionCard title="Kalkulator Tabungan">
          <div style={grid}>
            <KalField
              label="Target Tabungan (Rp)"
              value={tb.target}
              set={u(setTb)("target")}
            />
            <KalField
              label="Saldo Saat Ini (Rp)"
              value={tb.current}
              set={u(setTb)("current")}
            />
            <KalField
              label="Bunga per Tahun (%)"
              value={tb.bunga}
              set={u(setTb)("bunga")}
              num
            />
            <KalField
              label="Setoran per Bulan (Rp)"
              value={tb.setor}
              set={u(setTb)("setor")}
            />
          </div>
          <KalResult
            label="Estimasi Tercapai"
            value={`±${tbM} Bulan`}
            detail={
              <>
                Target tercapai sekitar:{" "}
                <strong style={{ color: "var(--primary)" }}>
                  {KAL_MONTHS[tbDate.getMonth()]} {tbDate.getFullYear()}
                </strong>
              </>
            }
          />
        </SectionCard>
      )}
      {tab === "splitgroup" && (
        <SectionCard title="Kalkulator Split Bill Group">
          <div
            style={{
              fontSize: 12,
              color: "var(--muted-foreground)",
              marginBottom: 14,
            }}
          >
            Hitung patungan untuk acara cafe, makan bareng, atau trip rombongan.
          </div>
          <div style={grid}>
            <KalField
              label="Total Tagihan (Rp)"
              value={sg.total}
              set={u(setSg)("total")}
            />
            <KalField
              label="Jumlah Orang"
              value={sg.people}
              set={u(setSg)("people")}
              num
            />
            <KalField
              label="Pajak / Service (%)"
              value={sg.tax}
              set={u(setSg)("tax")}
              num
            />
            <KalField
              label="Tip Tambahan (%)"
              value={sg.tip}
              set={u(setSg)("tip")}
              num
            />
          </div>
          <KalResult
            label="Per Orang Bayar"
            value={fmt(sgPer)}
            detail={
              <>
                Total + pajak/tip:{" "}
                <strong style={{ color: "var(--primary)" }}>
                  {fmt(sgGrand)}
                </strong>
              </>
            }
          />
          <div
            style={{
              marginTop: 14,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {NAMES.slice(0, Math.min(sgP, 10)).map((n) => (
              <div
                key={n}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  padding: "10px 14px",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>{n}</span>
                <span
                  className="mono"
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--primary)",
                  }}
                >
                  {fmt(sgPer)}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
window.ScreenKalkulator = ScreenKalkulator;
