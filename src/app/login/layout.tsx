import type { Metadata } from 'next';

// The login / sign-up screen is user-utility, not content, keep it out of the
// index. (The page itself is a client component, so robots metadata lives here
// in a server layout.) Links to it stay followable: nofollow on internal links
// just wastes crawl equity (Semrush #123), so the header links are plain.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
