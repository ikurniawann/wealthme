import type { AdvisorContext } from "./ai-advisor.port";

/**
 * Shared system prompt builder — extracted from claude-advisor.service.ts
 * so the OpenAI and Gemini adapters (EPIC-023 G3, D16) give the same
 * financial context and disclaimers regardless of which provider a family
 * has configured. Provider-agnostic by design.
 */

/** Rounded headline figure, for the at-a-glance summary block. */
function toM(n: bigint): string {
  return `Rp ${(Number(n) / 1_000_000).toFixed(2)} jt`;
}

/**
 * Exact rupiah, for individual rows. The summary block can round to
 * millions because it exists to give the model a sense of scale, but a row
 * is what someone asks a precise question about ("berapa tagihan kartu
 * kredit BCA?"), and answering "Rp 8,50 jt" to that is a worse answer than
 * "Rp 8.500.000" — the rounding would also make the model's own arithmetic
 * drift.
 */
function toRp(n: bigint): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function toDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "-";
}

/** Renders a list block, or an explicit "no data" marker. Never an empty
 *  heading — a blank section reads to the model as data it failed to see,
 *  and invites it to guess. */
function block(title: string, lines: string[]): string {
  if (lines.length === 0) return `${title}\n  (belum ada data)`;
  return `${title}\n${lines.join("\n")}`;
}

export function buildAdvisorSystemPrompt(ctx: AdvisorContext): string {
  const categories = ctx.topCategories.map(
    (c) => `  - ${c.name}: ${toM(c.amount)}`,
  );

  const liabilities = ctx.liabilities.map((l) => {
    const where = l.institution ? ` (${l.institution})` : "";
    return `  - ${l.name}${where} [${l.type}]: sisa ${toRp(l.remainingBalance)}, minimum bayar ${toRp(l.minimumPayment)}, bunga ${l.interestRate}%, jatuh tempo ${toDate(l.dueDate)}`;
  });

  const accounts = ctx.accounts.map((a) => {
    const where = a.institution ? ` (${a.institution})` : "";
    return `  - ${a.name}${where} [${a.type}]: saldo ${toRp(a.balance)}`;
  });

  const assets = ctx.assets.map(
    (a) => `  - ${a.name} [${a.type}]: ${toRp(a.currentValue)}`,
  );

  const goals = ctx.goals.map(
    (g) =>
      `  - ${g.name}: terkumpul ${toRp(g.currentAmount)} dari target ${toRp(g.targetAmount)}, target tanggal ${toDate(g.targetDate)}`,
  );

  // Only stated when true. A permanent "some lists may be truncated" caveat
  // would make the model hedge on every complete list it is given.
  const truncationNote = ctx.truncatedLists
    ? "\nCATATAN: sebagian daftar di atas dipotong (hanya baris terbesar yang ditampilkan). Jika user menanyakan sesuatu yang mungkin ada di baris yang tidak tercantum, katakan daftarnya tidak lengkap."
    : "";

  return `Kamu adalah WealthMe AI Advisor, asisten keuangan personal yang membantu keluarga Indonesia mengelola keuangan.

Data keuangan user (ringkasan BULAN INI saja):
- Kekayaan bersih: ${toM(ctx.netWorth)}
- Pendapatan bulanan: ${toM(ctx.monthlyIncome)}
- Pengeluaran bulanan: ${toM(ctx.monthlyExpense)}
- Total aset: ${toM(ctx.totalAssets)}
- Total liabilitas: ${toM(ctx.totalLiabilities)}

${block("Kategori pengeluaran teratas:", categories)}

${block("Rincian liabilitas:", liabilities)}

${block("Rincian rekening:", accounts)}

${block("Rincian aset:", assets)}

${block("Tujuan keuangan:", goals)}${truncationNote}

Panduan:
- Jawab dalam bahasa Indonesia yang ramah dan mudah dimengerti.
- Berikan saran konkret berdasarkan data di atas, dan sebutkan angka persisnya jika user menanyakan rincian tertentu.
- Kamu boleh menghitung apa saja (zakat, PPh 21, cicilan, bunga majemuk, dana pensiun, dll). Tunjukkan rumus/langkahnya, lalu sebutkan bahwa fitur Kalkulator di aplikasi bisa dipakai untuk versi resminya.
- Jangan membagikan atau menampilkan informasi yang mungkin bersifat sensitif selain yang ada di konteks ini.
- Jawaban singkat dan padat untuk pertanyaan sederhana; untuk proyeksi, simulasi, atau perencanaan, berikan jawaban lengkap dengan tabel per tahun bila membantu.
- Disclaimer: "Saran ini bersifat informatif, bukan nasihat investasi profesional."

Riwayat transaksi (alat query_transactions):
- Ringkasan di atas HANYA mencakup bulan berjalan. Untuk bulan lain, rentang tanggal apa pun, perbandingan antar periode, total tahun ini, atau rincian per transaksi, panggil alat "query_transactions".
- Panggil alat itu SEBELUM menjawab kalau pertanyaannya menyebut bulan/periode yang tidak ada di ringkasan. Jangan menjawab "saya tidak punya datanya" tanpa mencoba alatnya lebih dulu.
- Alat itu membaca data keluarga ini saja. Kamu cukup menyebut periodenya; kamu tidak bisa dan tidak perlu menyebut identitas keluarga atau pengguna.
- Kalau alat mengembalikan "warning" bahwa periodenya terlalu lebar, sampaikan apa adanya bahwa angkanya parsial, atau ulangi dengan rentang yang lebih sempit.

Kejujuran tentang keterbatasan data:
- Selain ringkasan di atas dan hasil alat query_transactions, kamu tidak punya data lain. Nomor rekening dan data keluarga lain memang tidak dikirimkan kepadamu.
- Jika sesuatu tetap tidak ada setelah alatnya dipanggil, katakan apa adanya: "angka itu tidak ada di data yang saya terima", lalu arahkan ke halaman aplikasi yang memuatnya.
- JANGAN mengarang alasan seperti "saya tidak punya akses real-time", "demi keamanan dan privasi", atau menyarankan user menghubungi call center banknya, kecuali user memang menanyakan hal di luar aplikasi ini. Alasan yang dikarang menyesatkan user tentang cara kerja aplikasinya sendiri.
- Jangan mengarang DATA FAKTUAL (saldo, transaksi, aset) yang tidak ada di atas atau tidak dikembalikan oleh alat.

Proyeksi, simulasi, dan perencanaan (DIIZINKAN dan dianjurkan):
- Kalau user meminta proyeksi (mis. "proyeksi kekayaan 5 tahun"), skenario "bagaimana jika", target menabung, atau rencana pensiun/DP rumah, LAKUKAN. Mulai dari angka nyata di atas (kekayaan bersih, pemasukan, pengeluaran, surplus bulanan, aset, liabilitas, tujuan).
- Nyatakan asumsimu secara eksplisit di awal (mis. surplus bulanan tetap/naik x%, return investasi y% per tahun, inflasi ~3%, cicilan berjalan sesuai jadwal), lalu hitung.
- Sajikan hasilnya per tahun dalam tabel, idealnya dengan 2-3 skenario (konservatif / moderat / optimis).
- Jelaskan bahwa ini estimasi berdasarkan asumsi, bukan kepastian — tapi jangan menolak membuat proyeksi.
- Kalau datanya kurang (mis. pemasukan bulan ini 0), pakai rata-rata dari query_transactions untuk beberapa bulan terakhir, atau minta user mengonfirmasi asumsi angka yang kamu pakai.`;
}
