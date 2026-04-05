import { createHash } from 'crypto';
import type { JobInput } from '../types.js';

interface RssSource {
  url: string;
  source: string;
  format: 'rss' | 'atom';
}

const RSS_SOURCES: readonly RssSource[] = [
  // ── Freelancer.com keyword feeds (?jobs= is broken, ?keyword= works) ─────────
  {
    url: 'https://www.freelancer.com/rss.xml?keyword=react',
    source: 'freelancer-react',
    format: 'rss',
  },
  {
    url: 'https://www.freelancer.com/rss.xml?keyword=typescript',
    source: 'freelancer-typescript',
    format: 'rss',
  },
  {
    url: 'https://www.freelancer.com/rss.xml?keyword=vue',
    source: 'freelancer-vue',
    format: 'rss',
  },
  {
    url: 'https://www.freelancer.com/rss.xml?keyword=next.js',
    source: 'freelancer-nextjs',
    format: 'rss',
  },
  {
    url: 'https://www.freelancer.com/rss.xml?keyword=node.js',
    source: 'freelancer-nodejs',
    format: 'rss',
  },
  // ── Reddit r/forhire — [Hiring] posts only (filtered during parse) ───────────
  {
    url: 'https://www.reddit.com/r/forhire/new/.rss',
    source: 'reddit-forhire',
    format: 'atom',
  },
  // ── Reddit r/slavelabour — small paid gigs ───────────────────────────────────
  {
    url: 'https://www.reddit.com/r/slavelabour/new/.rss',
    source: 'reddit-slavelabour',
    format: 'atom',
  },
  // ── PeoplePerHour — freelance gigs ───────────────────────────────────────────
  {
    url: 'https://www.peopleperhour.com/rss/hourlie?keyword=javascript',
    source: 'pph-js',
    format: 'rss',
  },
  {
    url: 'https://www.peopleperhour.com/rss/hourlie?keyword=react',
    source: 'pph-react',
    format: 'rss',
  },
  // ── Guru.com — freelance gigs ─────────────────────────────────────────────────
  {
    url: 'https://www.guru.com/jobs/rss/?skill=react',
    source: 'guru-react',
    format: 'rss',
  },
  {
    url: 'https://www.guru.com/jobs/rss/?skill=node.js',
    source: 'guru-nodejs',
    format: 'rss',
  },
  // ── Upwork — freelance jobs (requires login on some queries, may return 403) ──
  {
    url: 'https://www.upwork.com/ab/feed/jobs/rss?q=react&sort=recency',
    source: 'upwork-react',
    format: 'rss',
  },
  {
    url: 'https://www.upwork.com/ab/feed/jobs/rss?q=typescript&sort=recency',
    source: 'upwork-typescript',
    format: 'rss',
  },
  {
    url: 'https://www.upwork.com/ab/feed/jobs/rss?q=vue.js&sort=recency',
    source: 'upwork-vue',
    format: 'rss',
  },
  {
    url: 'https://www.upwork.com/ab/feed/jobs/rss?q=node.js&sort=recency',
    source: 'upwork-nodejs',
    format: 'rss',
  },
];

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; freelance-monitor/1.0)',
};

const FETCH_TIMEOUT_MS = 10_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripCdata(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('<![CDATA[') && trimmed.endsWith(']]>')) {
    return trimmed.slice(9, trimmed.length - 3).trim();
  }
  return trimmed;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

/** Extract text content of the first matching tag */
function extractText(xml: string, tag: string): string {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const start = xml.indexOf(open);
  if (start === -1) return '';
  const contentStart = start + open.length;
  const end = xml.indexOf(close, contentStart);
  if (end === -1) return '';
  return decodeEntities(stripCdata(xml.slice(contentStart, end)));
}

/** Extract all occurrences of a tag's inner content */
function extractAll(xml: string, tag: string): string[] {
  const results: string[] = [];
  const open = `<${tag}`;
  const close = `</${tag}>`;
  let cursor = 0;
  while (true) {
    const start = xml.indexOf(open, cursor);
    if (start === -1) break;
    const tagEnd = xml.indexOf('>', start);
    if (tagEnd === -1) break;
    const end = xml.indexOf(close, tagEnd);
    if (end === -1) break;
    results.push(xml.slice(tagEnd + 1, end));
    cursor = end + close.length;
  }
  return results;
}

/** Extract href attribute from <link rel="alternate" href="..."> */
function extractAtomLink(entryXml: string): string {
  const match = entryXml.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/i)
    ?? entryXml.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']alternate["']/i)
    ?? entryXml.match(/<link[^>]+href=["']([^"']+)["']/i);
  return match?.[1] ?? '';
}

function buildContentHash(source: string, title: string, description: string, budget: string | null): string {
  const normalized = [
    source,
    title.toLowerCase().trim(),
    description.toLowerCase().trim().slice(0, 500),
    budget ?? '',
  ].join('|');
  return createHash('sha256').update(normalized).digest('hex');
}

// ─── RSS 2.0 parser ───────────────────────────────────────────────────────────

function parseRssItem(itemXml: string, source: string): JobInput | null {
  const title = extractText(itemXml, 'title');
  const link = extractText(itemXml, 'link') || extractText(itemXml, 'guid');
  const description =
    extractText(itemXml, 'content:encoded') ||
    extractText(itemXml, 'description') ||
    extractText(itemXml, 'summary');
  const pubDateRaw = extractText(itemXml, 'pubDate') || extractText(itemXml, 'published');

  if (!title || !link) return null;

  const budget = extractText(itemXml, 'budget') || null;
  const location = extractText(itemXml, 'location') || null;

  let source_published_at: string | null = null;
  if (pubDateRaw) {
    const parsed = new Date(pubDateRaw);
    if (!isNaN(parsed.getTime())) source_published_at = parsed.toISOString();
  }

  const content_hash = buildContentHash(source, title, description, budget);

  return {
    source,
    external_id: link.trim(),
    canonical_url: link.trim(),
    title: title.trim().slice(0, 500),
    description: description.trim().slice(0, 5000),
    budget_text: budget?.trim().slice(0, 100) ?? null,
    location: location?.trim().slice(0, 100) ?? null,
    source_published_at,
    content_hash,
    raw_data: { title, link, description, budget, pubDate: pubDateRaw },
  };
}

// ─── Atom parser (Reddit) ─────────────────────────────────────────────────────

function parseAtomEntry(entryXml: string, source: string): JobInput | null {
  const title = decodeEntities(extractText(entryXml, 'title'));
  const link = extractAtomLink(entryXml);

  // Reddit feeds: skip posts that are NOT from job posters ([Hiring] only)
  if (
    (source === 'reddit-forhire' || source === 'reddit-slavelabour') &&
    !title.toLowerCase().includes('[hiring]')
  ) {
    return null;
  }

  // Content in Atom is HTML-encoded HTML — decode then strip tags
  const rawContent =
    extractText(entryXml, 'content') ||
    extractText(entryXml, 'summary');
  const description = stripHtml(decodeEntities(rawContent));

  const pubDateRaw = extractText(entryXml, 'published') || extractText(entryXml, 'updated');

  if (!title || !link) return null;

  let source_published_at: string | null = null;
  if (pubDateRaw) {
    const parsed = new Date(pubDateRaw);
    if (!isNaN(parsed.getTime())) source_published_at = parsed.toISOString();
  }

  const content_hash = buildContentHash(source, title, description, null);

  return {
    source,
    external_id: link.trim(),
    canonical_url: link.trim(),
    title: title.trim().slice(0, 500),
    description: description.trim().slice(0, 5000),
    budget_text: null,
    location: null,
    source_published_at,
    content_hash,
    raw_data: { title, link, description },
  };
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchFeed(rssSource: RssSource): Promise<JobInput[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(rssSource.url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);

    const xml = await response.text();
    const jobs: JobInput[] = [];

    if (rssSource.format === 'atom') {
      const entries = extractAll(xml, 'entry');
      for (const entryXml of entries) {
        try {
          const job = parseAtomEntry(entryXml, rssSource.source);
          if (job) jobs.push(job);
        } catch {
          // skip malformed entries
        }
      }
    } else {
      const items = extractAll(xml, 'item');
      for (const itemXml of items) {
        try {
          const job = parseRssItem(itemXml, rssSource.source);
          if (job) jobs.push(job);
        } catch {
          // skip malformed items
        }
      }
    }

    return jobs;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRssJobs(activeSources?: string[]): Promise<JobInput[]> {
  const sources = activeSources
    ? RSS_SOURCES.filter((s) => activeSources.includes(s.source))
    : RSS_SOURCES;
  const results = await Promise.allSettled(sources.map(fetchFeed));
  const jobs: JobInput[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const src = sources[i];
    if (result === undefined || src === undefined) continue;

    if (result.status === 'fulfilled') {
      console.log(`[ingestion] ${src.source}: fetched ${result.value.length} items`);
      jobs.push(...result.value);
    } else {
      console.error(`[ingestion] ${src.source}: failed — ${(result.reason as Error).message}`);
    }
  }

  return jobs;
}
