import type { ZodType } from 'zod'
import { readSettingsSync } from '#/main/services/settings-store'
import { completeJsonOpenAi } from '#/main/services/ai/openai-compatible'

/**
 * Central AI Gateway routing all structured JSON LLM requests.
 * Supports any OpenAI-compatible provider (OpenAI, OpenRouter, Groq, DeepSeek,
 * Together, Ollama). Manus web-chat automation can be plugged in here if chosen.
 */
export async function completeStructuredJson<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  const settings = readSettingsSync()

  if (settings.aiProvider === 'manus') {
    throw new Error(
      'Manus DOM automation is optional in this clean-room Linux build. Switch AI Provider to "OpenAI-Compatible" in Settings (supports OpenAI, OpenRouter, Groq, DeepSeek, or local Ollama).',
    )
  }

  if (!settings.openaiBaseUrl || !settings.openaiModel) {
    throw new Error('Configure your OpenAI-compatible Base URL and Model in Settings -> AI Provider.')
  }

  return completeJsonOpenAi(
    {
      baseUrl: settings.openaiBaseUrl,
      apiKey: settings.openaiApiKey,
      model: settings.openaiModel,
    },
    systemPrompt,
    userPrompt,
    schema,
    signal,
  )
}
