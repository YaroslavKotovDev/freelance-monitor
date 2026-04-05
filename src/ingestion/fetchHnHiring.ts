import type { JobInput } from '../types.js';
import { createHash } from 'crypto';

const ALGOLIA_URL = 'https://hn.algolia.com/api/v1';
const FETCH_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; freelance-monitor/1.0)' };
const KEYWORDS = ['react', 'typescript', 'node', 'next.js', 'vue', 'frontend', 'full-stack', 'fullstack'];

/** Find the current month's "Ask HN: Who is hiring?" thread ID */
async function findHiringThreadId(): Promise<string | null> {
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'long' });
  const year = now.getFullYear();
  const query = encodeURIComponent(`Ask HN: Who is hiring? (${month} ${year})`);

  const res = await fetch(
    `${ALGOLIA_URL}/search?query=${query}&tags=story,ask_hn&hitsPerPage=5`,
    { headers: FETCH_HEADERS },
  );
  if (!res.ok) throw new Error(`HN search failed: ${res.status}`);

  const data = await res.json() as { hits: Array<{ objectID: string; title: string }> };
  const hit = data.hits.find((h) =>
    h.title.toLowerCase().includes('who is hiring') &&
    h.title.includes(String(year)),
  );

  return hit?.objectID ?? null;
}

/** Fetch comments from the hiring thread, filter by keywords */
async function fetchHiringComments(threadId: string): Promise<JobInput[]> {
  const res = await fetch(
    `${ALGOLIA_URL}/search?tags=comment,story_${threadId}&hitsPerPage=100`,
    { headers: FETCH_HEADERS },
  );
  if (!res.ok) throw new Error(`HN comments failed: ${res.status}`);

  const data = await res.json() as {
    hits: Array<{
      objectID: string;
      author: string;
      comment_text: string | null;
      created_at: string;
    }>;
  };

  const jobs: JobInput[] = [];

  for (const hit of data.hits) {
    const text = hit.comment_text ?? '';
    const lower = text.toLowerCase();

    // Skip if none of our keywords appear
    if (!KEYWORDS.some((kw) => lower.includes(kw))) continue;
    // Skip if not a freelance/contract offer
    if (!lower.includes('freelance') && !lower.includes('contract') && !lower.includes('remote')) continue;

    // Extract first line as title
    const plain = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const title = plain.split(/[.\n|]/)[0]?.trim().slice(0, 200) ?? `HN hiring by ${hit.author}`;
    const link = `https://news.ycombinator.com/item?id=${hit.objectID}`;

    const content_hash = createHash('sha256')
      .update(`hn-hiring|${hit.objectID}`)
      .digest('hex');

    jobs.push({
      source: 'hn-hiring',
      external_id: hit.objectID,
      canonical_url: link,
      title,
      description: plain.slice(0, 5000),
      budget_text: null,
      location: null,
      source_published_at: hit.created_at,
      content_hash,
      raw_data: { objectID: hit.objectID, author: hit.author },
    });
  }

  return jobs;
}

export async function fetchHnHiringJobs(): Promise<JobInput[]> {
  try {
    const threadId = await findHiringThreadId();
    if (!threadId) {
      console.log('[hn-hiring] No current hiring thread found');
      return [];
    }
    console.log(`[hn-hiring] Thread: ${threadId}`);
    const jobs = await fetchHiringComments(threadId);
    console.log(`[hn-hiring] fetched ${jobs.length} matching comments`);
    return jobs;
  } catch (err) {
    console.error(`[hn-hiring] failed — ${(err as Error).message}`);
    return [];
  }
}
