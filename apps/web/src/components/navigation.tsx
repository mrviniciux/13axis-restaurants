"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { managementNavigation, primaryNavigation } from "@/lib/navigation";

function NavigationItems() {
  const pathname = usePathname();
  const links = (items: typeof primaryNavigation) =>
    items.map(({ href, icon: Icon, label }) => {
      const isCurrent = pathname === href;
      return (
        <Link
          aria-label={label}
          aria-current={isCurrent ? "page" : undefined}
          className="nav-link"
          href={href}
          key={href}
          title={label}
        >
          <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
          <span>{label}</span>
        </Link>
      );
    });

  return (
    <nav aria-label="Navegação principal" className="sidebar-nav">
      <div className="nav-group">
        <p className="nav-heading">Operação</p>
        {links(primaryNavigation)}
      </div>
      <div className="nav-group">
        <p className="nav-heading">Gestão</p>
        {links(managementNavigation)}
      </div>
    </nav>
  );
}

export function Navigation() {
  return <NavigationItems />;
}
