import type { Metadata } from "next";

// The login page is a client component, so its tab title lives on this server
// layout; the root template renders it as "Masuk | WealthMe".
export const metadata: Metadata = { title: "Masuk" };

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
