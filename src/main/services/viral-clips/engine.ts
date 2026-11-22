import crypto from 'node:crypto'
import { z } from 'zod'
import type { Cue, ViralClipCandidate, ViralClipScoreBreakdown } from '#/shared/types'
import { completeStructuredJson } from '#/main/services/ai/gateway'
import { hashCheckpointKey, readCheckpoint, writeCheckpoint } from '#/main/services/ai/checkpoint'

const DiscoveryItemSchema = z.object({
  title: z.string().min(1),
  start: z.number(),
  end: z.number(),
  reason: z.string().default(''),
  hookEvidence: z.string().default(''),
  payoffEvidence: z.string().default(''),
})

const DiscoveryResponseSchema = z.object({
  clips: z.array(DiscoveryItemSchema),
})

const ReviewItemSchema = z.object({
  index: z.number().int(),
  hookStrength: z.number().min(0).max(100),
  engagement: z.number().min(0).max(100),
  standaloneClarity: z.number().min(0).max(100),
  payoff: z.number().min(0).max(100),
  specificity: z.number().min(0).max(100),
  problems: z.array(z.string()).default([]),
})

const ReviewResponseSchema = z.object({
  reviews: z.array(ReviewItemSchema),
})

const DEFAULT_DISCOVERY_PROMPT = `You are a viral short-form video editor. Find high-retention standalone clips from the transcript.
Return JSON: { "clips": [{ "title": "...", "start": 12.4, "end": 58.2, "reason": "...", "hookEvidence": "exact quote from start", "payoffEvidence": "exact quote from end" }] }.
Every clip must have a strong hook in the first 3 seconds, complete standalone context, and a clear payoff.`

const DEFAULT_REVIEW_PROMPT = `You are a skeptical short-form producer auditing candidate clips.
Score each candidate 0-100 on: hookStrength, engagement, standaloneClarity, payoff, specificity.
List any structural problems (weak hook, mid-thought start, missing context, abrupt ending) in "problems".
Return JSON: { "reviews": [{ "index": 0, "hookStrength": 85, "engagement": 80, "standaloneClarity": 82, "payoff": 78, "specificity": 75, "problems": [] }] }.`

function parseLengthBounds(clipLength?: string): { min: number; max: number } {
  if (!clipLength) return { min: 25, max: 65 }
  const nums = clipLength.match(/\d+/g)?.map(Number) ?? []
  if (nums.length >= 2) return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) }
  if (nums.length === 1) return { min: Math.max(15, nums[0] - 15), max: nums[0] + 15 }
  return { min: 25, max: 65 }
}

function chunkCues(cues: Cue[], maxChars = 7500, overlapCues = 4): Cue[][] {
  const chunks: Cue[][] = []
  let i = 0
  while (i < cues.length) {
    const batch: Cue[] = []
    let chars = 0
    while (i < cues.length) {
      const lineLen = cues[i].text.length + 20
      if (batch.length > 0 && chars + lineLen > maxChars) break
      batch.push(cues[i])
      chars += lineLen
      i++
    }
    chunks.push(batch)
    if (i < cues.length) {
      i = Math.max(i - overlapCues, i - batch.length + 1)
    }
  }
  return chunks
}

function formatCuesForPrompt(cues: Cue[]): string {
  return cues
    .map((c) => `[${c.start.toFixed(2)} - ${c.end.toFixed(2)}] ${c.text.trim()}`)
    .join('\n')
}

/**
 * Snaps LLM-proposed clip start/end timestamps to clean word/sentence boundaries.
 */
function refineBoundaries(
  start: number,
  end: number,
  cues: Cue[],
  duration: number,
): { start: number; end: number } {
  const words = cues.flatMap((c) =>
    c.words && c.words.length > 0
      ? c.words
      : [{ word: c.text, start: c.start, end: c.end }],
  )
  if (words.length === 0) {
    return { start: Math.max(0, start), end: Math.min(duration, end) }
  }

  let bestStart = start
  let minStartDiff = Infinity
  for (const c of cues) {
    const d = Math.abs(c.start - start)
    if (d < minStartDiff && d <= 4.0) {
      minStartDiff = d
      bestStart = c.start
    }
  }

  let bestEnd = end
  let minEndDiff = Infinity
  for (const c of cues) {
    const d = Math.abs(c.end - end)
    if (d < minEndDiff && d <= 4.0) {
      minEndDiff = d
      bestEnd = c.end
    }
  }

  const clampedStart = Math.max(0, Math.min(bestStart, duration - 5))
  const clampedEnd = Math.max(clampedStart + 5, Math.min(bestEnd, duration))
  return { start: Number(clampedStart.toFixed(2)), end: Number(clampedEnd.toFixed(2)) }
}

function fourGrams(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const grams = new Set<string>()
  for (let i = 0; i <= tokens.length - 4; i++) {
    grams.add(tokens.slice(i, i + 4).join(' '))
  }
  return grams
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const item of a) {
    if (b.has(item)) intersection++
  }
  return intersection / (a.size + b.size - intersection)
}

function timeOverlapRatio(a: { start: number; end: number }, b: { start: number; end: number }): number {
  const inter = Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start))
  const minLen = Math.min(a.end - a.start, b.end - b.start)
  return minLen > 0 ? inter / minLen : 0
}

function transcriptInRange(cues: Cue[], start: number, end: number): string {
  return cues
    .filter((c) => c.end >= start && c.start <= end)
    .map((c) => c.text)
    .join(' ')
}

function computeWeightedScore(r: z.infer<typeof ReviewItemSchema>): ViralClipScoreBreakdown {
  const weightedTotal = Math.round(
    r.hookStrength * 0.2 +
      r.engagement * 0.2 +
      r.standaloneClarity * 0.25 +
      r.payoff * 0.25 +
      r.specificity * 0.1,
  )
  return {
    hookStrength: r.hookStrength,
    engagement: r.engagement,
    standaloneClarity: r.standaloneClarity,
    payoff: r.payoff,
    specificity: r.specificity,
    weightedTotal,
    problems: r.problems,
  }
}

function buildDeterministicFallback(
  cues: Cue[],
  duration: number,
  bounds: { min: number; max: number },
  existing: ViralClipCandidate[],
  targetCount: number,
): ViralClipCandidate[] {
  const results = [...existing]
  if (results.length >= targetCount || cues.length === 0) return results

  const targetLen = (bounds.min + bounds.max) / 2
  let cursor = 0

  while (cursor < cues.length && results.length < targetCount) {
    const startCue = cues[cursor]
    let endIdx = cursor
    while (endIdx + 1 < cues.length && cues[endIdx].end - startCue.start < targetLen) {
      endIdx++
    }
    const candidateRange = { start: startCue.start, end: Math.min(duration, cues[endIdx].end) }
    const len = candidateRange.end - candidateRange.start
    if (len >= Math.min(15, bounds.min)) {
      const overlaps = results.some((r) => timeOverlapRatio(r, candidateRange) > 0.35)
      if (!overlaps) {
        results.push({
          id: crypto.randomUUID(),
          title: startCue.text.slice(0, 64).trim() || `Clip ${results.length + 1}`,
          start: candidateRange.start,
          end: candidateRange.end,
          reason: 'Transcript sentence-window fallback candidate',
          score: 55,
          tier: 'fallback',
        })
      }
    }
    cursor = Math.max(endIdx + 1, cursor + 1)
  }

  return results
}

let activeController: AbortController | null = null

export function cancelViralClipDetection(): void {
  activeController?.abort()
  activeController = null
}

export async function detectViralClips(
  payload: {
    cues: Cue[]
    duration: number
    clipLength?: string
    clipsCount?: string
    prompts?: { discovery: string; review: string }
  },
  onProgress: (event: {
    progressFraction: number | null
    detail: string | null
    candidate?: ViralClipCandidate
  }) => void,
): Promise<ViralClipCandidate[]> {
  cancelViralClipDetection()
  const controller = new AbortController()
  activeController = controller

  const { cues, duration, clipLength, clipsCount, prompts } = payload
  const targetCount = Math.max(1, Number.parseInt(clipsCount || '5', 10) || 5)
  const bounds = parseLengthBounds(clipLength)
  const chunks = chunkCues(cues)

  const discoverySystem = prompts?.discovery?.trim() || DEFAULT_DISCOVERY_PROMPT
  const reviewSystem = prompts?.review?.trim() || DEFAULT_REVIEW_PROMPT

  const rawCandidates: Array<z.infer<typeof DiscoveryItemSchema>> = []

  // Pass 1: Discovery across chunks with SHA-256 checkpointing
  for (let i = 0; i < chunks.length; i++) {
    if (controller.signal.aborted) throw new Error('Cancelled')
    onProgress({
      progressFraction: (i / (chunks.length * 2)) * 0.9,
      detail: `Scanning transcript chunk ${i + 1} of ${chunks.length}…`,
    })

    const chunkText = formatCuesForPrompt(chunks[i])
    const ckKey = hashCheckpointKey(['viral-discovery-v1', discoverySystem, bounds, chunkText])
    let chunkResult = await readCheckpoint<z.infer<typeof DiscoveryResponseSchema>>(ckKey)

    if (!chunkResult) {
      const userPrompt = `Target clip length: ${bounds.min}–${bounds.max} seconds. Find up to ${Math.max(3, Math.ceil(targetCount / chunks.length) + 2)} strongest clips.\n\nTranscript:\n${chunkText}`
      chunkResult = await completeStructuredJson(
        discoverySystem,
        userPrompt,
        DiscoveryResponseSchema,
        controller.signal,
      )
      await writeCheckpoint(ckKey, chunkResult)
    }

    for (const item of chunkResult.clips) {
      const snapped = refineBoundaries(item.start, item.end, cues, duration)
      rawCandidates.push({ ...item, start: snapped.start, end: snapped.end })
    }
  }

  // Pass 2: Skeptical Review & 5-Dimension Weighted Scoring
  let scored: ViralClipCandidate[] = []
  if (rawCandidates.length > 0) {
    onProgress({
      progressFraction: 0.6,
      detail: `Auditing ${rawCandidates.length} candidate clips…`,
    })

    const reviewPayload = rawCandidates.map((c, index) => ({
      index,
      title: c.title,
      start: c.start,
      end: c.end,
      hookEvidence: c.hookEvidence,
      payoffEvidence: c.payoffEvidence,
      transcript: transcriptInRange(cues, c.start, c.end),
    }))

    const reviewCkKey = hashCheckpointKey(['viral-review-v1', reviewSystem, reviewPayload])
    let reviewResult = await readCheckpoint<z.infer<typeof ReviewResponseSchema>>(reviewCkKey)

    if (!reviewResult) {
      reviewResult = await completeStructuredJson(
        reviewSystem,
        JSON.stringify(reviewPayload),
        ReviewResponseSchema,
        controller.signal,
      )
      await writeCheckpoint(reviewCkKey, reviewResult)
    }

    const reviewByIndex = new Map(reviewResult.reviews.map((r) => [r.index, r]))

    scored = rawCandidates.map((c, idx) => {
      const rev = reviewByIndex.get(idx)
      const breakdown = rev ? computeWeightedScore(rev) : undefined
      const score = breakdown?.weightedTotal ?? 65
      const hasProblems = (breakdown?.problems.length ?? 0) > 0
      const tier: ViralClipCandidate['tier'] =
        score >= 75 && !hasProblems ? 'pass' : score >= 60 ? 'suggested' : 'fallback'

      return {
        id: crypto.randomUUID(),
        title: c.title,
        start: c.start,
        end: c.end,
        reason: c.reason,
        hookEvidence: c.hookEvidence,
        payoffEvidence: c.payoffEvidence,
        score,
        tier,
        breakdown,
      }
    })
  }

  // Sort by score descending and deduplicate (>35% time overlap or >=80% 4-gram Jaccard)
  scored.sort((a, b) => b.score - a.score)
  const deduped: ViralClipCandidate[] = []
  const gramCache = new Map<string, Set<string>>()

  for (const cand of scored) {
    const text = transcriptInRange(cues, cand.start, cand.end)
    const grams = fourGrams(text)
    const isDuplicate = deduped.some((kept) => {
      if (timeOverlapRatio(kept, cand) > 0.35) return true
      const keptGrams = gramCache.get(kept.id) ?? new Set<string>()
      return jaccard(keptGrams, grams) >= 0.8
    })
    if (!isDuplicate) {
      deduped.push(cand)
      gramCache.set(cand.id, grams)
      onProgress({ progressFraction: 0.85, detail: `Selected "${cand.title}"`, candidate: cand })
    }
    if (deduped.length >= targetCount) break
  }

  const finalClips = buildDeterministicFallback(cues, duration, bounds, deduped, targetCount).slice(
    0,
    targetCount,
  )

  onProgress({ progressFraction: 1, detail: `Found ${finalClips.length} clips.` })
  activeController = null
  return finalClips
}
