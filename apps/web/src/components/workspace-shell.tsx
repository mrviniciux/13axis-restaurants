"use client";

import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Navigation } from "@/components/navigation";

export function WorkspaceShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  if (pathname === "/login") return children;

  return (
    <>
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo principal
      </a>
      <div className={`app-shell${sidebarExpanded ? " app-shell-sidebar-expanded" : ""}`}>
        <aside aria-label="Menu do Mudra" className="sidebar">
          <div className="sidebar-brand-row">
            <Link aria-label="Mudra, voltar à visão geral" className="brand" href="/">
              <span aria-hidden="true" className="brand-mark">
                M
              </span>
              <span className="brand-copy">
                <span className="brand-name">mudra</span>
                <span className="brand-caption">gestão para restaurantes</span>
              </span>
            </Link>
            <button
              aria-expanded={sidebarExpanded}
              aria-label={sidebarExpanded ? "Recolher menu" : "Expandir menu"}
              className="sidebar-toggle"
              onClick={() => setSidebarExpanded((expanded) => !expanded)}
              title={sidebarExpanded ? "Recolher menu" : "Expandir menu"}
              type="button"
            >
              {sidebarExpanded ? (
                <PanelLeftClose aria-hidden="true" size={18} />
              ) : (
                <PanelLeftOpen aria-hidden="true" size={18} />
              )}
            </button>
          </div>
          <Navigation />
          <div className="sidebar-footer">
            <div className="sidebar-footer-info">
              <strong>Ambiente inicial</strong>
              Fundação da plataforma web
            </div>
            <button
              className="sidebar-sign-out"
              onClick={() => signOut({ redirectTo: "/login" })}
              type="button"
            >
              <LogOut aria-hidden="true" size={16} />
              <span>Sair</span>
            </button>
          </div>
        </aside>

        <div className="main-column">
          <main className="content" id="main-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
