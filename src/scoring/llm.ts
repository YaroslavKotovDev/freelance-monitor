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
Ты — AI-рекрутер для TypeScript/Node.js разработчика-фрилансера.
Оцени следующий фриланс-заказ.

Источник: ${source}
Заголовок: ${title}
Бюджет: ${budget ?? 'не указан'}
Описание: ${description.slice(0, 1500)}

Ответь ТОЛЬКО валидным JSON, без markdown и пояснений:
{
  "relevanceScore": <целое число 0-100, насколько заказ подходит TS/Node.js разработчику>,
  "summary": "<одно предложение — суть заказа на русском>",
  "recommendation": "<одно предложение — стоит брать или нет и почему, на русском>",
  "risks": ["<риск 1>", "<риск 2>"],
  "stackFit": "<одно предложение — насколько стек совпадает, на русском>"
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
