'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

// Left-rail navigation for the Settings sub-pages. Grouped into labelled
// sections (General / Commerce / System) and ordered by how often each is
// touched, so the rail scans quickly instead of reading as a flat list of 8.
// Stays in sync with the route via usePathname; on small screens the rail
// collapses to a horizontal pill scroller (see globals.css @media 900px,
// where the group wrappers `display:contents` so the links flatten into one
// row and the section labels/icons/descs hide).

type Item = { href: string; label: string; desc: string; icon: ReactNode };
type Group = { label: string; items: Item[] };

// 16px lucide-style glyphs — inherit colour from the link via currentColor.
const I = (paths: ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg>
);

const GROUPS: Group[] = [
  {
    label: 'General',
    items: [
      { href: '/admin/settings/profile', label: 'Store profile', desc: 'Name, contact, social',
        icon: I(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>) },
      { href: '/admin/settings/branding', label: 'Branding & theme', desc: 'Colours, seasonal',
        icon: I(<><circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></>) },
      { href: '/admin/settings/homepage', label: 'Homepage', desc: 'Hero, sale, banner',
        icon: I(<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></>) },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { href: '/admin/settings/shipping', label: 'Shipping & tax', desc: 'Rates, thresholds',
        icon: I(<><rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></>) },
      { href: '/admin/settings/payments', label: 'Payments', desc: 'Methods, bank accounts',
        icon: I(<><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></>) },
      { href: '/admin/settings/loyalty', label: 'Loyalty', desc: 'Points & rewards',
        icon: I(<><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></>) },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/settings/notifications', label: 'Notifications', desc: 'Staff alerts',
        icon: I(<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>) },
      { href: '/admin/settings/integrations', label: 'Integrations', desc: 'GA4, Sentry, email',
        icon: I(<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></>) },
    ],
  },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <aside className="adm-settings-nav" style={{ width: 232, flexShrink: 0, paddingRight: 16 }}>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {GROUPS.map(group => (
          <div key={group.label} className="adm-settings-nav-group">
            <div className="adm-settings-nav-group-label">{group.label}</div>
            {group.items.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className="adm-settings-nav-link"
                >
                  <span className="adm-settings-nav-icon">{item.icon}</span>
                  <span className="adm-settings-nav-text">
                    <span className="adm-settings-nav-label">{item.label}</span>
                    <span className="adm-settings-nav-desc">{item.desc}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
