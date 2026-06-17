import type { Metadata, Viewport } from "next";
import { Sora, DM_Mono } from "next/font/google";
import "./globals.css";
import { SessionProviderWrapper } from "@/components/providers/session-provider-wrapper";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { AppQueryClientProvider } from "@/components/providers/query-client-provider";
import { Toaster } from "@/components/ui/sonner";

const sora = Sora({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WealthMe — Personal Wealth OS",
  description:
    "Personal Wealth Operating System — kelola transaksi, investasi, aset, warisan, pajak, dan donasi dalam satu aplikasi.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${sora.variable} ${dmMono.variable}`}
    >
      {/*
       * No-flash script: runs synchronously before first paint so the correct
       * data-theme attribute is present before CSS is applied.
       * Mirrors the next-themes anti-FOUC pattern for the color-preset axis.
       * Valid non-default preset ids are inlined as a literal array — the
       * script cannot import from lib/themes.ts at runtime.
       */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k="wealthme-theme-preset";var valid=["emerald","rose","amber","violet","slate"];var v=localStorage.getItem(k);if(v&&valid.indexOf(v)!==-1){document.documentElement.dataset.theme=v;}else{delete document.documentElement.dataset.theme;}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey="wealthme-theme"
          disableTransitionOnChange
        >
          <AppQueryClientProvider>
            <SessionProviderWrapper>
              <AuthProvider>{children}</AuthProvider>
            </SessionProviderWrapper>
          </AppQueryClientProvider>
          <Toaster position="bottom-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
