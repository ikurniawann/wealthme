"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/wm";
import { Button } from "@/components/ui/button";
import { formatRupiah, parseRupiah, formatAmountInput, formatNumber } from "@/lib/format";

const FIELD_CLASS =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

const MONTHS = [
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

const GROUP_NAMES = [
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

type TabKey = "investasi" | "kredit" | "pensiun" | "tabungan" | "splitgroup";

const TABS: { key: TabKey; label: string }[] = [
  { key: "investasi", label: "📈 Investasi" },
  { key: "kredit", label: "💳 Kredit" },
  { key: "pensiun", label: "🏖️ Pensiun" },
  { key: "tabungan", label: "🏦 Tabungan" },
  { key: "splitgroup", label: "🧾 Split Group" },
];

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12.5px] font-semibold">{label}</label>
      {children}
    </div>
  );
}

function ResultCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: ReactNode;
}) {
  return (
    <div className="mt-4 rounded-[14px] border border-primary/30 bg-accent p-[18px] text-center">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[26px] font-black text-primary-strong">{value}</div>
      <div className="mt-1.5 text-[12px] text-muted-foreground">{detail}</div>
    </div>
  );
}

/* ─────────────────────────── Investasi ─────────────────────────── */

function InvestasiTab() {
  const [modal, setModal] = useState("50.000.000");
  const [monthly, setMonthly] = useState("2.000.000");
  const [rate, setRate] = useState("12");
  const [years, setYears] = useState("10");

  const { fv, totalModal, profit } = useMemo(() => {
    const m = parseRupiah(modal);
    const mo = parseRupiah(monthly);
    const r = Number(rate) / 100 / 12;
    const n = Number(years) * 12;
    const factor = Math.pow(1 + r, n);
    const fvCalc = r === 0 ? m + mo * n : m * factor + (mo * (factor - 1)) / r;
    const totalModalCalc = m + mo * n;
    return { fv: fvCalc, totalModal: totalModalCalc, profit: fvCalc - totalModalCalc };
  }, [modal, monthly, rate, years]);

  return (
    <SectionCard title="Kalkulator Investasi">
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <Field label="Modal Awal (Rp)">
          <input
            type="text"
            inputMode="numeric"
            value={modal}
            onChange={(e) => setModal(formatAmountInput(e.target.value))}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label="Setoran Bulanan (Rp)">
          <input
            type="text"
            inputMode="numeric"
            value={monthly}
            onChange={(e) => setMonthly(formatAmountInput(e.target.value))}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label="Return per Tahun (%)">
          <input
            type="number"
            min={0}
            max={100}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label="Jangka Waktu (Tahun)">
          <input
            type="number"
            min={1}
            max={50}
            value={years}
            onChange={(e) => setYears(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
      </div>
      <ResultCard
        label="Estimasi Nilai Akhir"
        value={formatRupiah(fv)}
        detail={
          <>
            Modal total: <strong className="text-foreground">{formatRupiah(totalModal)}</strong> ·
            Keuntungan: <strong className="text-success">{formatRupiah(profit)}</strong>
          </>
        }
      />
    </SectionCard>
  );
}

/* ─────────────────────────── Kredit / KPR ─────────────────────────── */

function KreditTab() {
  const [pinjaman, setPinjaman] = useState("500.000.000");
  const [bunga, setBunga] = useState("7");
  const [tenor, setTenor] = useState("20");
  const [dp, setDp] = useState("20");

  const { cicilan, pokok, total } = useMemo(() => {
    const p = parseRupiah(pinjaman);
    const pokokCalc = p * (1 - Number(dp) / 100);
    const r = Number(bunga) / 100 / 12;
    const n = Number(tenor) * 12;
    const factor = Math.pow(1 + r, n);
    const cicilanCalc = r === 0 ? pokokCalc / n : (pokokCalc * r * factor) / (factor - 1);
    return { cicilan: cicilanCalc, pokok: pokokCalc, total: cicilanCalc * n };
  }, [pinjaman, bunga, tenor, dp]);

  return (
    <SectionCard title="Kalkulator Kredit / KPR">
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <Field label="Jumlah Pinjaman (Rp)">
          <input
            type="text"
            inputMode="numeric"
            value={pinjaman}
            onChange={(e) => setPinjaman(formatAmountInput(e.target.value))}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label="Bunga per Tahun (%)">
          <input
            type="number"
            min={0}
            max={50}
            value={bunga}
            onChange={(e) => setBunga(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label="Tenor (Tahun)">
          <input
            type="number"
            min={1}
            max={30}
            value={tenor}
            onChange={(e) => setTenor(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label="DP (%)">
          <input
            type="number"
            min={0}
            max={100}
            value={dp}
            onChange={(e) => setDp(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
      </div>
      <ResultCard
        label="Cicilan per Bulan"
        value={formatRupiah(cicilan)}
        detail={
          <>
            Pokok pinjaman: <strong className="text-foreground">{formatRupiah(pokok)}</strong> ·
            Total bayar: <strong className="text-destructive">{formatRupiah(total)}</strong>
          </>
        }
      />
    </SectionCard>
  );
}

/* ─────────────────────────── Pensiun ─────────────────────────── */

function PensiunTab() {
  const [now, setNow] = useState("30");
  const [retire, setRetire] = useState("55");
  const [monthly, setMonthly] = useState("10.000.000");
  const [ret, setRet] = useState("10");

  const { needed, pmt } = useMemo(() => {
    const years = Number(retire) - Number(now);
    const mo = parseRupiah(monthly);
    const neededCalc = mo * 12 * 20;
    const r = Number(ret) / 100 / 12;
    const n = years * 12;
    const factor = Math.pow(1 + r, n);
    const pmtCalc =
      n <= 0 ? 0 : r === 0 ? neededCalc / n : (neededCalc * r * factor) / (factor - 1);
    return { needed: neededCalc, pmt: pmtCalc };
  }, [now, retire, monthly, ret]);

  return (
    <SectionCard title="Kalkulator Dana Pensiun">
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <Field label="Usia Sekarang">
          <input
            type="number"
            value={now}
            onChange={(e) => setNow(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label="Target Usia Pensiun">
          <input
            type="number"
            value={retire}
            onChange={(e) => setRetire(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label="Pengeluaran/Bulan Saat Ini (Rp)">
          <input
            type="text"
            inputMode="numeric"
            value={monthly}
            onChange={(e) => setMonthly(formatAmountInput(e.target.value))}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label="Return Investasi (%/thn)">
          <input
            type="number"
            value={ret}
            onChange={(e) => setRet(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
      </div>
      <ResultCard
        label="Dana Pensiun yang Dibutuhkan"
        value={formatRupiah(needed)}
        detail={
          <>
            Investasi bulanan yang dibutuhkan:{" "}
            <strong className="text-primary">{formatRupiah(pmt)}</strong>
          </>
        }
      />
    </SectionCard>
  );
}

/* ─────────────────────────── Tabungan ─────────────────────────── */

function TabunganTab() {
  const [target, setTarget] = useState("100.000.000");
  const [current, setCurrent] = useState("10.000.000");
  const [bunga, setBunga] = useState("4");
  const [setor, setSetor] = useState("3.000.000");

  const { bln, label } = useMemo(() => {
    const t = parseRupiah(target);
    const r = Number(bunga) / 100 / 12;
    const s = parseRupiah(setor);
    let saldo = parseRupiah(current);
    let months = 0;
    while (saldo < t && months < 600) {
      saldo = saldo * (1 + r) + s;
      months++;
    }
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    const targetLabel = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    return { bln: months, label: targetLabel };
  }, [target, current, bunga, setor]);

  return (
    <SectionCard title="Kalkulator Tabungan">
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <Field label="Target Tabungan (Rp)">
          <input
            type="text"
            inputMode="numeric"
            value={target}
            onChange={(e) => setTarget(formatAmountInput(e.target.value))}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label="Saldo Saat Ini (Rp)">
          <input
            type="text"
            inputMode="numeric"
            value={current}
            onChange={(e) => setCurrent(formatAmountInput(e.target.value))}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label="Bunga per Tahun (%)">
          <input
            type="number"
            value={bunga}
            onChange={(e) => setBunga(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label="Setoran per Bulan (Rp)">
          <input
            type="text"
            inputMode="numeric"
            value={setor}
            onChange={(e) => setSetor(formatAmountInput(e.target.value))}
            className={FIELD_CLASS}
          />
        </Field>
      </div>
      <ResultCard
        label="Estimasi Tercapai"
        value={`±${formatNumber(bln)} Bulan`}
        detail={
          <>
            Target tercapai sekitar: <strong className="text-primary">{label}</strong>
          </>
        }
      />
    </SectionCard>
  );
}

/* ─────────────────────────── Split Group ─────────────────────────── */

function SplitGroupTab() {
  const [total, setTotal] = useState("1.250.000");
  const [people, setPeople] = useState("5");
  const [tax, setTax] = useState("10");
  const [tip, setTip] = useState("0");

  const { per, grand, count } = useMemo(() => {
    const t = parseRupiah(total);
    const p = Math.max(1, Number(people) || 0);
    const grandCalc = t + (t * Number(tax)) / 100 + (t * Number(tip)) / 100;
    return { per: Math.round(grandCalc / p), grand: grandCalc, count: p };
  }, [total, people, tax, tip]);

  const breakdownCount = Math.min(count, 10);

  return (
    <SectionCard title="Kalkulator Split Bill Group">
      <div className="-mt-1 mb-3.5 text-[12px] text-muted-foreground">
        Hitung patungan untuk acara cafe, makan bareng, atau trip rombongan.
      </div>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <Field label="Total Tagihan (Rp)">
          <input
            type="text"
            inputMode="numeric"
            value={total}
            onChange={(e) => setTotal(formatAmountInput(e.target.value))}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label="Jumlah Orang">
          <input
            type="number"
            min={1}
            value={people}
            onChange={(e) => setPeople(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label="Pajak / Service (%)">
          <input
            type="number"
            value={tax}
            onChange={(e) => setTax(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label="Tip Tambahan (%)">
          <input
            type="number"
            value={tip}
            onChange={(e) => setTip(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
      </div>
      <ResultCard
        label="Per Orang Bayar"
        value={formatRupiah(per)}
        detail={
          <>
            Total + pajak/tip: <strong className="text-primary">{formatRupiah(grand)}</strong>
          </>
        }
      />
      <div className="mt-3.5 space-y-1.5">
        {GROUP_NAMES.slice(0, breakdownCount).map((name) => (
          <div
            key={name}
            className="flex items-center justify-between rounded-md border px-3.5 py-2.5"
          >
            <span className="text-[13px] font-semibold">{name}</span>
            <span className="text-[13px] font-bold text-primary">{formatRupiah(per)}</span>
          </div>
        ))}
      </div>
      <Button
        className="mt-3.5 w-full"
        onClick={() => toast.success("Lanjutkan buat Split Bill →")}
      >
        <Share2 className="size-4" /> Buat Split Bill dari Hitungan Ini
      </Button>
    </SectionCard>
  );
}

/* ─────────────────────────── Page ─────────────────────────── */

export default function KalkulatorPage() {
  const [tab, setTab] = useState<TabKey>("investasi");

  return (
    <div className="space-y-4">
      <div className="hide-scrollbar flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "shrink-0 cursor-pointer rounded-full px-3.5 py-2 text-[12.5px] font-semibold whitespace-nowrap transition-colors " +
              (tab === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-secondary/70")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "investasi" && <InvestasiTab />}
      {tab === "kredit" && <KreditTab />}
      {tab === "pensiun" && <PensiunTab />}
      {tab === "tabungan" && <TabunganTab />}
      {tab === "splitgroup" && <SplitGroupTab />}
    </div>
  );
}
