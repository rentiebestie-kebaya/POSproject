import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TenantProvider } from "@/data/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "RENTIE — Kebaya Rental Management",
  description: "Inventory, booking, POS, dan keuangan untuk butik kebaya modern.",
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">👘</text></svg>',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>
        <TenantProvider>{children}</TenantProvider>
      </body>
    </html>
  );
}
