import crypto from 'node:crypto'
import fs from 'node:fs'
import type { Cue, DeepgramTranscribeResult, SpeechChunk, WordTimestamp } from '#/shared/types'
import { extractOpusChunks } from '#/main/services/transcription/audio-extract'

export async function testDeepgramKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  const key = apiKey.trim()
  if (!key) return { valid: false, error: 'API key is empty.' }

  try {
    const res = await fetch('https://api.deepgram.com/v1/projects', {
      headers: { Authorization: `Token ${key}` },
    })
    if (res.ok) return { valid: true }
    return { valid: false, error: `Deepgram rejected key (${res.status})` }
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function transcribeWithDeepgram(payload: {
  filePath?: string
  range?: { start?: number; end?: number }
  duration?: number
  apiKey: string
  model?: string
  language?: string
}): Promise<DeepgramTranscribeResult> {
  if (!payload.filePath) {
    throw new Error('Deepgram transcription requires a local media filePath.')
  }

  const chunks = await extractOpusChunks(payload.filePath, payload.duration ?? 0, payload.range)
  const allCues: Cue[] = []
  const allChunks: SpeechChunk[] = []
  const textParts: string[] = []

  try {
    for (const part of chunks) {
      const audioBuf = await fs.promises.readFile(part.filePath)
      const params = new URLSearchParams({
        model: payload.model || 'nova-3',
        smart_format: 'true',
        punctuate: 'true',
        utterances: 'true',
        diarize: 'true',
      })
      if (payload.language && payload.language !== 'auto') {
        params.set('language', payload.language)
      } else {
        params.set('detect_language', 'true')
      }

      const res = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${payload.apiKey.trim()}`,
          'Content-Type': 'audio/ogg',
        },
        body: audioBuf,
      })

      if (!res.ok) {
        throw new Error(`Deepgram listen error (${res.status}): ${await res.text()}`)
      }

      const data = (await res.json()) as {
        results?: {
          utterances?: Array<{
            start: number
            end: number
            transcript: string
            speaker?: number
            words?: Array<{
              word: string
              punctuated_word?: string
              start: number
              end: number
              confidence?: number
              speaker?: number
            }>
          }>
          channels?: Array<{
            alternatives?: Array<{ transcript?: string }>
          }>
        }
      }

      const utterances = data.results?.utterances ?? []
      for (const utt of utterances) {
        const words: WordTimestamp[] = (utt.words ?? []).map((w) => ({
          word: w.punctuated_word || w.word,
          start: w.start + part.offsetSec,
          end: w.end + part.offsetSec,
          confidence: w.confidence,
          speaker: w.speaker,
        }))
        const start = utt.start + part.offsetSec
        const end = utt.end + part.offsetSec

        allCues.push({
          id: crypto.randomUUID(),
          start,
          end,
          text: utt.transcript,
          words,
          speaker: utt.speaker,
        })
        allChunks.push({
          text: utt.transcript,
          timestamp: [start, end],
          words,
          speaker: utt.speaker,
        })
      }

      const fullTranscript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript
      if (fullTranscript) textParts.push(fullTranscript)
    }
  } finally {
    for (const part of chunks) {
      await fs.promises.unlink(part.filePath).catch(() => {})
    }
  }

  return {
    text: textParts.join(' ').trim(),
    chunks: allChunks,
    cues: allCues,
  }
}
