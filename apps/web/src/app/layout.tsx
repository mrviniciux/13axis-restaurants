import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/workspace-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Mudra | Gestão do restaurante",
    template: "%s | Mudra",
  },
  description: "Back-office e Kitchen Display do Mudra for Restaurants.",
  applicationName: "Mudra for Restaurants",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <WorkspaceShell>{children}</WorkspaceShell>
      </body>
    </html>
  );
}
