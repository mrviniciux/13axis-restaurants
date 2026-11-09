import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/workspace-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "13axis | Gestão do restaurante",
    template: "%s | 13axis",
  },
  description: "Back-office e Kitchen Display do 13axis for Restaurants.",
  applicationName: "13axis for Restaurants",
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
