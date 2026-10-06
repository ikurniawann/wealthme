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
  title: {
    template: "%s | WealthMe",
    default: "WealthMe, Personal Wealth OS",
  },
  description:
    "Personal Wealth Operating System, kelola transaksi, investasi, aset, warisan, pajak, dan donasi dalam satu aplikasi.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5",
  // `env(safe-area-inset-*)` evaluates to 0 unless the viewport opts into the
  // display cutout area, and the mobile shell already relies on those insets
  // (`.mobile-nav` bottom padding, `.topbar` top padding, `.mobile-fab`
  // offset). Without this they were computing against zero, so on a notched
  // iPhone the bottom bar sat under the home indicator.
  viewportFit: "cover",
  // Keyboard opens: resize the CONTENT rather than shrink the visual viewport
  // out from under fixed elements. Without it, focusing an input on iOS
  // Safari leaves `position: fixed` bars floating over the keyboard.
  interactiveWidget: "resizes-content",
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
