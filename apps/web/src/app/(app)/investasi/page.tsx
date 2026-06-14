"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { SectionCard, StatusBadge } from "@/components/wm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CrudModal,
  RowActions,
  ConfirmDeleteDialog,
  type CrudModalState,
} from "@/components/crud";

type Holding = {
  logo: string;
  logoBg: string;
  logoColor?: string;
  name: string;
  ticker: string;
  badge: { variant: "info" | "purple" | "warning" | "success"; label: string };
  modal: string;
  nilai: string;
  ret: string;
  pct: string;
  up: boolean;
};

const HOLDINGS: Holding[] = [
  {
    logo: "BCA",
    logoBg: "#0061AF",
    name: "Bank Central Asia",
    ticker: "BBCA · Saham",
    badge: { variant: "info", label: "Saham" },
    modal: "Rp 50.000.000",
    nilai: "Rp 62.300.000",
    ret: "+Rp 12.300.000",
    pct: "+24,6%",
    up: true,
  },
  {
    logo: "BRI",
    logoBg: "#E31937",
    name: "Bank Rakyat Indonesia",
    ticker: "BBRI · Saham",
    badge: { variant: "info", label: "Saham" },
    modal: "Rp 30.000.000",
    nilai: "Rp 28.500.000",
    ret: "-Rp 1.500.000",
    pct: "-5,0%",
    up: false,
  },
  {
    logo: "RD",
    logoBg: "#7C3AED",
    name: "Reksa Dana Bibit",
    ticker: "Campuran",
    badge: { variant: "purple", label: "Reksa Dana" },
    modal: "Rp 100.000.000",
    nilai: "Rp 124.800.000",
    ret: "+Rp 24.800.000",
    pct: "+24,8%",
    up: true,
  },
  {
    logo: "Au",
    logoBg: "#D97706",
    logoColor: "#fff",
    name: "Emas Digital",
    ticker: "Antam / Pegadaian",
    badge: { variant: "warning", label: "Emas" },
    modal: "Rp 45.000.000",
    nilai: "Rp 50.000.000",
    ret: "+Rp 5.000.000",
    pct: "+11,1%",
    up: true,
  },
  {
    logo: "ORI",
    logoBg: "#1E3A5F",
    name: "ORI024",
    ticker: "Obligasi Negara",
    badge: { variant: "success", label: "Obligasi" },
    modal: "Rp 80.000.000",
    nilai: "Rp 80.300.000",
    ret: "+Rp 300.000",
    pct: "+0,4%",
    up: true,
  },
  {
    logo: "RDT",
    logoBg: "#F97316",
    name: "Reksa Dana Trimegah",
    ticker: "Saham",
    badge: { variant: "purple", label: "Reksa Dana" },
    modal: "Rp 120.400.000",
    nilai: "Rp 231.300.000",
    ret: "+Rp 110.900.000",
    pct: "+92,1%",
    up: true,
  },
];

export default function InvestasiPage() {
  const [crudState, setCrudState] = useState<CrudModalState | null>(null);
  const [deleteLabel, setDeleteLabel] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <div className="text-[15px] font-bold">Portofolio Investasi</div>
          <div className="text-[12px] text-muted-foreground">
            {HOLDINGS.length} instrumen · Total Rp 577.200.000
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setCrudState({ entity: "investasi", mode: "add" })}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Tambah
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <Card className="gap-0 p-5">
          <div className="mb-1 text-[11px] text-muted-foreground">
            Total Nilai Investasi
          </div>
          <div className="text-[24px] font-black text-primary">
            Rp 577.200.000
          </div>
          <div className="mt-1 text-[12px] text-success">
            ▲ 12,40% · +Rp 75.551.000 total return
          </div>
        </Card>
        <Card className="gap-0 p-5">
          <div className="mb-1 text-[11px] text-muted-foreground">
            Return Hari Ini
          </div>
          <div className="text-[24px] font-black text-success">
            +Rp 1.250.000
          </div>
          <div className="mt-1 text-[12px] text-success">
            ▲ +0,22% dari kemarin
          </div>
        </Card>
      </div>

      {/* Portfolio table */}
      <SectionCard title="Daftar Portofolio">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b text-left text-[11px] text-muted-foreground">
                <th className="py-2.5 pr-3 font-semibold">Nama</th>
                <th className="py-2.5 pr-3 font-semibold">Jenis</th>
                <th className="py-2.5 pr-3 font-semibold">Modal</th>
                <th className="py-2.5 pr-3 font-semibold">Nilai</th>
                <th className="py-2.5 pr-3 font-semibold">Return</th>
                <th className="py-2.5 pr-3 font-semibold">%</th>
                <th className="py-2.5 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {HOLDINGS.map((h) => (
                <tr key={h.name} className="border-b last:border-0">
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-7 w-9 items-center justify-center rounded-md text-[10px] font-extrabold text-white"
                        style={{ background: h.logoBg, color: h.logoColor }}
                      >
                        {h.logo}
                      </div>
                      <div>
                        <div className="font-semibold">{h.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {h.ticker}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <StatusBadge variant={h.badge.variant}>
                      {h.badge.label}
                    </StatusBadge>
                  </td>
                  <td className="mono py-3 pr-3 whitespace-nowrap">
                    {h.modal}
                  </td>
                  <td className="mono py-3 pr-3 font-extrabold whitespace-nowrap">
                    {h.nilai}
                  </td>
                  <td
                    className={`mono py-3 pr-3 whitespace-nowrap ${
                      h.up ? "text-success" : "text-destructive"
                    }`}
                  >
                    {h.ret}
                  </td>
                  <td
                    className={`py-3 pr-3 font-semibold whitespace-nowrap ${
                      h.up ? "text-success" : "text-destructive"
                    }`}
                  >
                    {h.pct}
                  </td>
                  <td className="py-3">
                    <RowActions
                      onEdit={() =>
                        setCrudState({
                          entity: "investasi",
                          mode: "edit",
                          initialValues: { nama: h.name },
                        })
                      }
                      onDelete={() => setDeleteLabel("Investasi")}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Shared modals — rendered once at root */}
      <CrudModal state={crudState} onClose={() => setCrudState(null)} />
      <ConfirmDeleteDialog
        label={deleteLabel}
        onClose={() => setDeleteLabel(null)}
        onConfirm={() => {
          setDeleteLabel(null);
          toast("🗑️ Investasi dihapus.");
        }}
      />
    </div>
  );
}
