"use client";

import { useState } from "react";
import Link from "next/link";
import { ArcButtonProbe } from "@/components/arc-probe/arc-button-probe";

export default function ArcProbePage() {
  const [activations, setActivations] = useState(0);
  const [label, setLabel] = useState("Simpan");

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Arc Button probe</h1>
      <section aria-label="Button states" className="flex flex-wrap gap-4">
        <ArcButtonProbe
          label={label}
          onClick={() => setActivations((count) => count + 1)}
        />
        <ArcButtonProbe label="Tidak aktif" disabled />
        <ArcButtonProbe label="Memuat" loading />
      </section>
      <p data-testid="activation-count">Aktivasi: {activations}</p>
      <button type="button" onClick={() => setLabel("Tersimpan")}>
        Ganti label
      </button>
      <Link href="/login">Kembali ke login</Link>
    </main>
  );
}
