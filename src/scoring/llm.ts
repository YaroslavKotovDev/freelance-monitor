import { z } from 'zod';

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const AiScoreSchema = z.object({
  relevanceScore: z.number().int().min(0).max(100),
  summary: z.string().min(1),
  recommendation: z.string().min(1),
  risks: z.array(z.string()),
  stackFit: z.string().min(1),
});

export type AiScore = z.infer<typeof AiScoreSchema>;

const PROMPT_TEMPLATE = (
  title: string,
  description: string,
  budget: string | null,
  source: string,
): string => `
You are an AI recruiter evaluating freelance job listings for a TypeScript/Node.js developer.

Source: ${source}
Title: ${title}
Budget: ${budget ?? 'not specified'}
Description: ${description.slice(0, 1500)}

Respond with ONLY valid JSON, no markdown, no explanation.
Write "summary", "recommendation", "risks", and "stackFit" in Ukrainian language.
{
  "relevanceScore": <integer 0-100, how relevant this job is for a TS/Node.js developer>,
  "summary": "<one sentence summary in Ukrainian>",
  "recommendation": "<one sentence: take it or skip it and why, in Ukrainian>",
  "risks": ["<risk 1 in Ukrainian>", "<risk 2 in Ukrainian>"],
  "stackFit": "<one sentence about stack match in Ukrainian>"
}
`.trim();

export async function callLlm(
  title: string,
  description: string,
  budget: string | null,
  source: string,
): Promise<AiScore> {
  const apiKey = getRequiredEnv('LLM_API_KEY');
  const model = getRequiredEnv('LLM_MODEL');
  const provider = getRequiredEnv('LLM_PROVIDER');

  const url = provider === 'openai'
    ? 'https://api.openai.com/v1/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: PROMPT_TEMPLATE(title, description, budget, source) }],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json() as { choices: Array<{ message: { content: string } }> };
  const content = json.choices[0]?.message?.content?.trim();
  if (!content) throw new Error('Empty LLM response');

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (!match?.[1]) throw new Error(`Invalid JSON from LLM: ${content.slice(0, 200)}`);
    parsed = JSON.parse(match[1]);
  }

  const result = AiScoreSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`LLM response failed validation: ${result.error.message}`);
  }

  return result.data;
}
