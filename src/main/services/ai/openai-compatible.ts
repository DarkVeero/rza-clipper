import type { ZodType } from 'zod'

export interface OpenAiConfig {
  baseUrl: string
  apiKey: string
  model: string
}

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '')
}

function extractJsonBlock(text: string): unknown {
  const trimmed = text.trim()
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed)
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed
  try {
    return JSON.parse(candidate)
  } catch {
    const firstBrace = candidate.indexOf('{')
    const firstBracket = candidate.indexOf('[')
    const start =
      firstBrace === -1
        ? firstBracket
        : firstBracket === -1
          ? firstBrace
          : Math.min(firstBrace, firstBracket)
    if (start === -1) throw new Error('Model response did not contain valid JSON')
    const openChar = candidate[start]
    const closeChar = openChar === '{' ? '}' : ']'
    const end = candidate.lastIndexOf(closeChar)
    if (end <= start) throw new Error('Model response JSON was truncated')
    return JSON.parse(candidate.slice(start, end + 1))
  }
}

async function postChatOrResponses(
  cfg: OpenAiConfig,
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal,
): Promise<string> {
  const base = normalizeBaseUrl(cfg.baseUrl)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (cfg.apiKey.trim()) {
    headers.Authorization = `Bearer ${cfg.apiKey.trim()}`
  }

  const chatRes = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.2,
      reasoning_effort: 'none',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (chatRes.ok) {
    const json = (await chatRes.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = json.choices?.[0]?.message?.content
    if (!content) throw new Error('Empty response from /chat/completions')
    return content
  }

  // Fallback to /responses on 404/405/501
  if ([404, 405, 501].includes(chatRes.status)) {
    const respRes = await fetch(`${base}/responses`, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        model: cfg.model,
        instructions: systemPrompt,
        input: userPrompt,
      }),
    })
    if (!respRes.ok) {
      throw new Error(`OpenAI-compatible /responses failed (${respRes.status}): ${await respRes.text()}`)
    }
    const json = (await respRes.json()) as {
      output_text?: string
      output?: Array<{ content?: Array<{ text?: string }> }>
    }
    const text = json.output_text || json.output?.[0]?.content?.[0]?.text
    if (!text) throw new Error('Empty response from /responses')
    return text
  }

  throw new Error(`OpenAI-compatible API error (${chatRes.status}): ${await chatRes.text()}`)
}

/**
 * Calls an OpenAI-compatible endpoint and validates the JSON payload against a Zod schema
 * with up to 3 attempts (feeding parse/schema errors back on retry).
 */
export async function completeJsonOpenAi<T>(
  cfg: OpenAiConfig,
  systemPrompt: string,
  userPrompt: string,
  schema: ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  let lastError: unknown = null
  let prompt = userPrompt

  for (let attempt = 1; attempt <= 3; attempt++) {
    const raw = await postChatOrResponses(cfg, systemPrompt, prompt, signal)
    try {
      const parsed = extractJsonBlock(raw)
      return schema.parse(parsed)
    } catch (err) {
      lastError = err
      const reason = err instanceof Error ? err.message : String(err)
      prompt = `${userPrompt}\n\nPrevious output failed JSON validation (${reason}). Return ONLY valid JSON matching the exact schema.`
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to parse AI JSON response')
}

export async function testOpenAiConnection(
  baseUrl: string,
  apiKey: string,
  model: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    await postChatOrResponses(
      { baseUrl, apiKey, model },
      'Reply with OK.',
      'Ping',
    )
    return { valid: true }
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
