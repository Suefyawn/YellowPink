'use client';

// Microsoft Clarity loader: session recordings, heatmaps, rage/dead-click
// detection. Activated by a Clarity project id, which the owner sets in
// Admin → Settings → Integrations (site_settings.clarity_project_id, passed
// in by the root layout) OR via NEXT_PUBLIC_CLARITY_PROJECT_ID as a fallback.
//
// Same rules as GoogleAnalytics:
//   • Gated on analytics consent. Clarity records what a visitor does on the
//     page, which is more sensitive than a pageview, so visitors who have not
//     opted in never download the tag at all.
//   • Staff traffic is not storefront traffic. Recording an admin session
//     would also capture order and customer screens, so the recorder is
//     stopped whenever the route is under /admin or /reviewer and restarted
//     when it leaves.
//
// The bootstrap is Clarity's own snippet from clarity.microsoft.com, kept
// verbatim so the project's "Complete setup" check recognises it.

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useConsent } from '@/lib/consent';

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

const isStaffPath = (p: string | null) => !!p && (p.startsWith('/admin') || p.startsWith('/reviewer'));

// Stop the recorder on staff routes and start it again on the storefront.
// The clarity() global is a queue stub before the tag loads, so calling it
// early is safe: the command is replayed once the script is up.
function StaffPathGate() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.clarity !== 'function') return;
    window.clarity(isStaffPath(pathname) ? 'stop' : 'start');
  }, [pathname]);
  return null;
}

export function MicrosoftClarity({ projectId }: { projectId?: string } = {}) {
  const { consent } = useConsent();
  const pathname = usePathname();
  // Admin-settings value wins; fall back to the build-time env var.
  const id = (projectId?.trim() || process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID) || undefined;
  if (!id) return null;
  if (!consent?.analytics) return null;
  // First paint on a staff route: do not load the tag at all.
  if (isStaffPath(pathname)) return null;
  return (
    <>
      <Script id="clarity-init" strategy="afterInteractive">
        {`
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", ${JSON.stringify(id)});
          // The visitor opted in before this ran, so tell Clarity it may set
          // its cookies; without this call it runs cookieless and sessions
          // fragment across page loads.
          window.clarity("consent");
        `}
      </Script>
      <StaffPathGate />
    </>
  );
}
