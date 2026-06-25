import type { Metadata } from 'next';

// The doctor portal is private — never index any of it.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ReviewerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
