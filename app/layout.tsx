import type { Metadata } from "next";
import "./globals.css";
import { CustomerAccountBar } from "@/app/_components/CustomerAccountBar";

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
      <body className="antialiased">
        <CustomerAccountBar />
        {children}
      </body>
    </html>
  );
}
