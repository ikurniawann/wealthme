"use client";

import "./laporan.css";

import { Suspense, useState } from "react";
import { localIsoDate } from "@/lib/local-date";
import { LaporanInner } from "./_components/laporan-inner";
import { LaporanMobileSummary } from "./_components/mobile-summary";

export default function Page() {
  // Phones (<= 720px) open on a one-month spending summary; the full report
  // below stays one tap away and follows the summary's month when opened.
  const [month, setMonth] = useState(() => localIsoDate().slice(0, 7));
  const [fullOpen, setFullOpen] = useState(false);
  const toggleFull = () => {
    setFullOpen((open) => !open);
    if (fullOpen) return;
    requestAnimationFrame(() =>
      document
        .getElementById("laporan-full")
        ?.scrollIntoView({ block: "start", behavior: "smooth" }),
    );
  };
  return (
    <Suspense fallback={null}>
      <LaporanMobileSummary
        month={month}
        onMonth={setMonth}
        fullOpen={fullOpen}
        onToggleFull={toggleFull}
      />
      <LaporanInner phoneMonth={fullOpen ? month : null} />
    </Suspense>
  );
}
