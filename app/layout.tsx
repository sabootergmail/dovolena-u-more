import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Výběr dovolené k moři",
  description:
    "Srovnání zájezdů k moři pro rodinu 2 dospělí + 2 děti (5 a 8 let)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
