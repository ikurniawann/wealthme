"use client";

import "./laporan.css";

import { Suspense } from "react";
import { LaporanInner } from "./_components/laporan-inner";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LaporanInner />
    </Suspense>
  );
}
