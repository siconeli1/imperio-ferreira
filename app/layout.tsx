import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Imperio Ferreira",
  description: "Agendamento online e area administrativa da Imperio Ferreira",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
