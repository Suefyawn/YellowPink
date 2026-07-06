// Suggests the most-qualified medical reviewer for a blog post by matching
// the post's category, title and excerpt against each board member's
// review_topics + specialty. Pure and deterministic so the same logic drives
// the live hint in the post editor (client) and the bulk assignment triage
// on /admin/reviewers (server).
//
// A suggestion is exactly that: staff still confirm every assignment, because
// "Medically reviewed by Dr. X" is a truth claim about who read the article —
// never auto-apply.

export interface MatchableReviewer {
  id: string;
  name: string;
  specialty: string | null;
  review_topics: string[];
  is_default: boolean;
  active: boolean;
}

export interface MatchablePost {
  title: string;
  category: string;
  excerpt?: string | null;
  /** The post's catalogue topic (lib/review-topics). When set, a reviewer who
   *  covers this exact topic is the direct, dominant match. */
  topic?: string | null;
}

export interface ReviewerSuggestion {
  reviewerId: string;
  reviewerName: string;
  /** Human-readable why, e.g. `covers Fertility · title mentions “folic acid”` */
  reason: string;
  score: number;
}

// Blog categories that carry no medical claim — a "medically reviewed" byline
// on these would be noise, so no reviewer is suggested.
const NON_MEDICAL_CATEGORIES = new Set(['makeup']);

// Keyword expansion per topic label the board actually uses. Tokens are
// matched as whole words against the post title/excerpt. Keep entries
// lowercase; topic labels are normalised (curly quotes → straight) first.
const TOPIC_KEYWORDS: Record<string, string[]> = {
  "women's health": ['women', 'woman', 'period', 'periods', 'pcos', 'menopause', 'pregnancy', 'pregnant', 'breastfeeding', 'cranberry', 'uti', 'iron'],
  "men's health": ['men', 'man', 'testosterone', 'prostate', 'beard', 'stamina'],
  'fertility': ['fertility', 'fertile', 'conceive', 'conception', 'ovulation', 'folic', 'sperm', 'ttc', 'ivf'],
  'bone & joint': ['bone', 'bones', 'joint', 'joints', 'calcium', 'arthritis', 'osteoporosis', 'knee', 'cartilage', 'glucosamine'],
  'skincare': ['skin', 'acne', 'melasma', 'sunscreen', 'spf', 'retinol', 'niacinamide', 'glycolic', 'azelaic', 'pigmentation', 'eczema', 'moisturizer', 'serum', 'pores', 'wrinkles'],
  'hair care': ['hair', 'dandruff', 'biotin', 'alopecia', 'scalp', 'shampoo'],
  'supplements': ['supplement', 'supplements', 'vitamin', 'vitamins', 'mineral', 'multivitamin', 'omega', 'tablets', 'capsules', 'gummies', 'collagen', 'zinc', 'magnesium'],
  'brain health and nervous system': ['brain', 'sleep', 'melatonin', 'memory', 'migraine', 'nerve', 'nerves', 'stress', 'anxiety', 'focus', 'insomnia'],
  'heart health': ['heart', 'cholesterol', 'cardiovascular', 'blood pressure', 'omega'],
  'medicine': ['medicine', 'medicines', 'dose', 'dosage', 'tablets'],
  'medicines': ['medicine', 'medicines', 'dose', 'dosage', 'tablets'],
};

// Topic labels that map straight onto blog categories (category hit = the
// strongest signal we have).
const TOPIC_CATEGORY_ALIASES: Record<string, string[]> = {
  "women's health": ["women's health"],
  "men's health": ["men's health"],
  'fertility': ['fertility'],
  'bone & joint': ['bone & joint'],
  'skincare': ['skincare'],
  'hair care': ['hair'],
  'supplements': ['wellness'],
  'brain health and nervous system': ['wellness'],
  'heart health': ['heart health', 'wellness'],
};

const normalise = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

function wordHit(haystack: string, needle: string): boolean {
  // Whole-word match; needles may be phrases ("blood pressure").
  return new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(haystack);
}

export function suggestReviewer(
  post: MatchablePost,
  reviewers: MatchableReviewer[],
): ReviewerSuggestion | null {
  const category = normalise(post.category ?? '');
  if (!category || NON_MEDICAL_CATEGORIES.has(category)) return null;

  const title = normalise(post.title ?? '');
  const excerpt = normalise(post.excerpt ?? '');
  const postTopic = normalise(post.topic ?? '');
  const candidates = reviewers.filter(r => r.active);
  if (candidates.length === 0) return null;

  let best: ReviewerSuggestion | null = null;
  // Tie-break metadata: on equal score prefer the more specialised reviewer
  // (fewer topics, non-default) — otherwise the default board member, who
  // covers six topics, would tie-win every category and the specialists
  // would never surface.
  let bestMeta = { topics: Number.MAX_SAFE_INTEGER, isDefault: true };

  for (const r of candidates) {
    const topics = (r.review_topics ?? []).map(normalise);
    let score = 0;
    const reasons: string[] = [];

    // 0. Direct topic match — the whole point of the topic catalogue. When the
    // post is tagged with a topic and this reviewer covers it, that's the
    // strongest, most defensible signal, well above any keyword guess.
    if (postTopic && topics.includes(postTopic)) {
      score += 6;
      reasons.push(`covers ${post.topic}`);
    }

    for (const topic of topics) {
      // 1. Category coverage — the strongest, most defensible signal.
      const aliases = TOPIC_CATEGORY_ALIASES[topic] ?? [topic];
      if (aliases.includes(category)) {
        score += 3;
        reasons.push(`covers ${post.category}`);
      }
      // 2. Title / excerpt keyword hits for this topic.
      const keywords = TOPIC_KEYWORDS[topic] ?? [topic];
      const titleHit = keywords.find(k => wordHit(title, k));
      if (titleHit) {
        score += 2;
        reasons.push(`title mentions “${titleHit}”`);
      } else {
        const excerptHit = keywords.find(k => wordHit(excerpt, k));
        if (excerptHit) {
          score += 1;
          reasons.push(`excerpt mentions “${excerptHit}”`);
        }
      }
    }

    // 3. Specialty words in the title (e.g. "Gastroenterology" post areas).
    const specialtyWords = normalise(r.specialty ?? '').split(/[,/&]+/).map(s => s.trim()).filter(w => w.length > 3);
    const spHit = specialtyWords.find(w => wordHit(title, w));
    if (spHit) {
      score += 2;
      reasons.push(`specialty: ${spHit}`);
    }

    // 4. Default reviewer is the qualified fallback for any medical post.
    if (r.is_default && score === 0) {
      score = 1;
      reasons.push('board default for health content');
    }

    const meta = { topics: topics.length || Number.MAX_SAFE_INTEGER, isDefault: r.is_default };
    const beatsBest = !best
      || score > best.score
      || (score === best.score && !meta.isDefault && bestMeta.isDefault)
      || (score === best.score && meta.isDefault === bestMeta.isDefault && meta.topics < bestMeta.topics);
    if (score > 0 && beatsBest) {
      best = {
        reviewerId: r.id,
        reviewerName: r.name,
        reason: Array.from(new Set(reasons)).slice(0, 3).join(' · '),
        score,
      };
      bestMeta = meta;
    }
  }

  return best;
}
