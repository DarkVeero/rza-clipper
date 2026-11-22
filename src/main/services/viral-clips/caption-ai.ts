import { z } from 'zod'
import { completeStructuredJson } from '#/main/services/ai/gateway'

const activeControllers = new Map<string, AbortController>()

export function cancelAiRequest(requestId: string): void {
  const ctrl = activeControllers.get(requestId)
  if (ctrl) {
    ctrl.abort()
    activeControllers.delete(requestId)
  }
}

const EmphasisSchema = z.object({
  selections: z.array(
    z.object({
      cueId: z.string(),
      wordIndex: z.number().int().nullable(),
      importance: z.number().min(0).max(100),
    }),
  ),
})

/**
 * Selects <=1 high-impact word per caption, enforcing a ceiling of 1-in-5 captions
 * and importance score 95–100.
 */
export async function selectCaptionEmphasis(requestId: string, payload: unknown) {
  const ctrl = new AbortController()
  activeControllers.set(requestId, ctrl)
  try {
    const system = `Pick at most 1 standout emphasis word per caption for short-form video kinetic subtitles.
Only mark words with importance 95-100, and mark at most 1 out of every 5 captions.
Return JSON: { "selections": [{ "cueId": "...", "wordIndex": 2, "importance": 97 }] }.`
    const result = await completeStructuredJson(
      system,
      JSON.stringify(payload),
      EmphasisSchema,
      ctrl.signal,
    )
    return {
      selections: result.selections.filter((s) => s.importance >= 95 && s.wordIndex !== null),
    }
  } finally {
    activeControllers.delete(requestId)
  }
}

const FixCaptionsSchema = z.object({
  cues: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
    }),
  ),
})

/**
 * Phonetic correction (including Hindi Devanagari / Arabic / Urdu script fixes)
 * and optional transliteration (Urdu native, Roman Urdu, Roman Hindi).
 */
export async function fixOrTransliterateCaptions(requestId: string, payload: unknown) {
  const ctrl = new AbortController()
  activeControllers.set(requestId, ctrl)
  try {
    const system = `You are a multilingual subtitle editor supporting English, Urdu, Roman Urdu, Hindi (Devanagari & Roman Hindi), and Arabic.
Correct transcription/phonetic errors or transliterate into the requested target script while preserving exact cue IDs and natural spoken timing.
Return JSON: { "cues": [{ "id": "...", "text": "..." }] }.`
    return await completeStructuredJson(
      system,
      JSON.stringify(payload),
      FixCaptionsSchema,
      ctrl.signal,
    )
  } finally {
    activeControllers.delete(requestId)
  }
}

const PublishingCopySchema = z.object({
  title: z.string(),
  description: z.string(),
  hashtags: z.array(z.string()),
})

export async function generatePublishingCopy(requestId: string, payload: unknown) {
  const ctrl = new AbortController()
  activeControllers.set(requestId, ctrl)
  try {
    const system = `Write punchy short-form social media publishing copy (YouTube Shorts, Reels, TikTok) for the provided clip transcript.
Return JSON: { "title": "...", "description": "...", "hashtags": ["#tag1", "#tag2"] }.`
    return await completeStructuredJson(
      system,
      JSON.stringify(payload),
      PublishingCopySchema,
      ctrl.signal,
    )
  } finally {
    activeControllers.delete(requestId)
  }
}
