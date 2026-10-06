import type { Metadata } from "next";

// The account page is a client component, so its server-rendered tab title
// lives on this layout ("Akun | WealthMe" via the root template). PageGreeting
// keeps the title in step on client-side navigation.
export const metadata: Metadata = { title: "Akun" };

export default function AkunLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
