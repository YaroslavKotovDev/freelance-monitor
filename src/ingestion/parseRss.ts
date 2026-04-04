import { createHash } from 'crypto';
import type { JobInput } from '../types.js';

interface RssSource {
  url: string;
  source: string;
}

const RSS_SOURCES: readonly RssSource[] = [
  {
    // Freelancer.com — JavaScript category (id=3)
    url: 'https://www.freelancer.com/rss.xml?jobs=3',
    source: 'freelancer-js',
  },
  {
    // Freelancer.com — HTML/CSS category (id=9)
    url: 'https://www.freelancer.com/rss.xml?jobs=9',
    source: 'freelancer-html',
  },
  {
    // Freelancer.com — React.js category (id=759)
    url: 'https://www.freelancer.com/rss.xml?jobs=759',
    source: 'freelancer-react',
  },
];

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; freelance-monitor/1.0)',
};

const FETCH_TIMEOUT_MS = 10_000;

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

function buildContentHash(source: string, title: string, description: string, budget: string | null): string {
  const normalized = [source, title.toLowerCase().trim(), description.toLowerCase().trim().slice(0, 500), budget ?? ''].join('|');
  return createHash('sha256').update(normalized).digest('hex');
}

function parseItem(itemXml: string, source: string): JobInput | null {
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
    if (!isNaN(parsed.getTime())) {
      source_published_at = parsed.toISOString();
    }
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

async function fetchFeed(rssSource: RssSource): Promise<JobInput[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(rssSource.url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    const items = extractAll(xml, 'item');
    const jobs: JobInput[] = [];

    for (const itemXml of items) {
      try {
        const job = parseItem(itemXml, rssSource.source);
        if (job) jobs.push(job);
      } catch {
        // skip malformed items
      }
    }

    return jobs;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRssJobs(): Promise<JobInput[]> {
  const results = await Promise.allSettled(RSS_SOURCES.map(fetchFeed));
  const jobs: JobInput[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const src = RSS_SOURCES[i];
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
