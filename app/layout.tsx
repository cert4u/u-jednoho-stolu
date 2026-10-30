import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "U jednoho stolu | Dobrodružství začíná tady",
  description: "Jednoduchý herní stůl pro společné večery s Dračí družinou.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body className="antialiased">{children}</body>
    </html>
  );
}
