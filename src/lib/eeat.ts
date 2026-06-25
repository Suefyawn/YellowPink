// E-E-A-T helpers for YMYL (health/wellness) content.
//
// Google holds "Your Money or Your Life" content — which supplements/health
// squarely are — to a high Experience/Expertise/Authoritativeness/Trust bar.
// The single strongest signal for health articles is a visible, credentialed
// MEDICAL REVIEWER ("Medically reviewed by …"), surfaced both on-page and in
// the Article schema (reviewedBy). One reviewer applies store-wide, so it's
// configured once in Admin → Settings rather than per post.
//
// IMPORTANT: this is only ever populated with a REAL, named reviewer the store
// owner provides. We never fabricate a clinician — fake credentials violate
// Google's guidelines and mislead readers. When no reviewer is set, every
// consumer here returns null and the UI/schema simply omit the block.

export interface MedicalReviewer {
  /** Real person's name, e.g. "Dr. Ayesha Khan". */
  name: string;
  /** Post-nominal credentials, e.g. "PharmD", "MBBS", "Registered Nutritionist". */
  credentials?: string;
  /** Public professional profile (LinkedIn, clinic, PMDC reg) — used as the
   *  Person.url / sameAs so the expertise is verifiable. */
  url?: string;
}

/** Resolve the store-wide medical reviewer from site_settings, or null when the
 *  owner hasn't configured one yet. */
export function medicalReviewer(
  settings: Record<string, string | undefined> | null | undefined,
): MedicalReviewer | null {
  const name = settings?.medical_reviewer_name?.trim();
  if (!name) return null;
  return {
    name,
    credentials: settings?.medical_reviewer_credentials?.trim() || undefined,
    url: settings?.medical_reviewer_url?.trim() || undefined,
  };
}

/** "Dr. Ayesha Khan, PharmD" — name with credentials appended when present. */
export function reviewerLabel(r: MedicalReviewer): string {
  return r.credentials ? `${r.name}, ${r.credentials}` : r.name;
}
