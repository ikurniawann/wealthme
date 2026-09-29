import { LegalShell, LegalSection } from "../_components/legal-shell";

// Hardening batch G2 — akun Tentang's "Lisensi Open Source" row toasted
// "belum tersedia" on click. A curated list of the major open-source
// packages WealthMe is built on, not an exhaustive auto-generated
// dependency dump (hundreds of transitive packages) — same "draft, not
// final" caveat as the other /legal pages, since license terms should
// eventually be verified/generated from the real lockfile.
const LIBRARIES: { name: string; license: string; url: string }[] = [
  { name: "Next.js", license: "MIT", url: "https://nextjs.org" },
  { name: "React", license: "MIT", url: "https://react.dev" },
  {
    name: "NestJS",
    license: "MIT",
    url: "https://nestjs.com",
  },
  { name: "Prisma", license: "Apache-2.0", url: "https://www.prisma.io" },
  {
    name: "TanStack Query",
    license: "MIT",
    url: "https://tanstack.com/query",
  },
  { name: "Tailwind CSS", license: "MIT", url: "https://tailwindcss.com" },
  { name: "Base UI", license: "MIT", url: "https://base-ui.com" },
  { name: "Better Auth", license: "MIT", url: "https://www.better-auth.com" },
  { name: "ApexCharts", license: "MIT", url: "https://apexcharts.com" },
  { name: "Lucide", license: "ISC", url: "https://lucide.dev" },
  { name: "Sonner", license: "MIT", url: "https://sonner.emilkowal.ski" },
  { name: "Zod", license: "MIT", url: "https://zod.dev" },
  {
    name: "Argon2",
    license: "MIT",
    url: "https://www.npmjs.com/package/argon2",
  },
  {
    name: "pdf.js",
    license: "Apache-2.0",
    url: "https://mozilla.github.io/pdf.js",
  },
  { name: "Socket.IO", license: "MIT", url: "https://socket.io" },
];

export default function OpenSourceLicensesPage() {
  return (
    <LegalShell title="Lisensi Open Source" updatedAt="29 September 2026">
      <LegalSection heading="Pustaka yang Digunakan">
        <p>
          WealthMe dibangun menggunakan sejumlah pustaka open-source. Daftar di
          bawah ini mencakup komponen utama; daftar lengkap seluruh dependensi
          (termasuk yang transitif) belum digenerate secara otomatis dari
          lockfile proyek.
        </p>
      </LegalSection>

      <ul className="divide-y divide-border overflow-hidden rounded-[10px] border">
        {LIBRARIES.map((lib) => (
          <li
            key={lib.name}
            className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[12.5px]"
          >
            <a
              href={lib.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground hover:text-primary"
            >
              {lib.name}
            </a>
            <span className="text-muted-foreground">{lib.license}</span>
          </li>
        ))}
      </ul>
    </LegalShell>
  );
}
