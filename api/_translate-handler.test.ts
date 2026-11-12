import { ApiError } from '@google/genai'
import type { GenerateContentParameters } from '@google/genai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const generateContent = vi.fn<(params: GenerateContentParameters) => Promise<{ text?: string }>>()
const usageInserts: Record<string, unknown>[] = []

vi.mock('@google/genai', async (importActual) => {
  const actual = await importActual<typeof import('@google/genai')>()
  return {
    ...actual,
    GoogleGenAI: class {
      models = { generateContent }
    },
  }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1', email: 'a@b.c' } }, error: null }),
    },
    from: (table: string) => {
      if (table === 'api_usage') {
        return {
          insert: async (row: Record<string, unknown>) => {
            usageInserts.push(row)
            return { error: null }
          },
        }
      }
      return {
        select: () => ({
          eq: () => ({ single: async () => ({ data: { email: 'a@b.c' }, error: null }) }),
        }),
      }
    },
  }),
}))

const { handleTranslate, TRANSLATION_MODELS } = await import('./_translate-handler')
const [primary, fallback] = TRANSLATION_MODELS

const validResult = {
  word: 'house',
  translations: ['das Haus'],
  sentencesSource: ['1. The **house** is big.'],
  sentencesGerman: ['1. Das **Haus** ist groß.'],
}

function ok() {
  return { text: JSON.stringify(validResult) }
}

function apiError(status: number, message: string) {
  return new ApiError({ status, message })
}

/** A request that never answers, and fails only when the handler aborts it. */
function hang(params: GenerateContentParameters) {
  return new Promise<never>((_, reject) => {
    params.config?.abortSignal?.addEventListener('abort', () =>
      reject(new DOMException('This operation was aborted', 'AbortError')),
    )
  })
}

function calledModels() {
  return generateContent.mock.calls.map(([params]) => params.model)
}

function translate() {
  return handleTranslate({ word: 'house', language: 'EN' }, 'Bearer token', 'http://x', 'key')
}

/** Runs the handler while advancing fake timers through its backoff delays and timeouts. */
async function translateWithTimers() {
  const promise = translate()
  await vi.runAllTimersAsync()
  return promise
}

describe('handleTranslate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    generateContent.mockReset()
    usageInserts.length = 0
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not use the model that shuts down on 2026-12-01', () => {
    expect(TRANSLATION_MODELS.map((m) => m.model)).not.toContain('gemini-2.5-flash')
  })

  it('returns the translation from the first model', async () => {
    generateContent.mockResolvedValueOnce(ok())

    const result = await translateWithTimers()

    expect(result).toEqual({ status: 200, body: validResult })
    expect(calledModels()).toEqual([primary.model])
    expect(usageInserts).toEqual([expect.objectContaining({ model: primary.model, success: true })])
  })

  it('asks for JSON that matches the schema, so the model cannot return malformed JSON', async () => {
    generateContent.mockResolvedValueOnce(ok())

    await translateWithTimers()

    const config = generateContent.mock.calls[0][0].config
    expect(config?.responseMimeType).toBe('application/json')
    expect(config?.responseSchema).toMatchObject({
      required: ['word', 'translations', 'sentencesSource', 'sentencesGerman'],
    })
    expect(config?.abortSignal).toBeInstanceOf(AbortSignal)
  })

  it('reports depleted credits (402) clearly, without retrying or falling back', async () => {
    const message =
      '{"error":{"code":402,"message":"Your prepayment credits are depleted.","status":"RESOURCE_EXHAUSTED"}}'
    generateContent.mockRejectedValue(apiError(402, message))

    const result = await translateWithTimers()

    expect(result.status).toBe(503)
    expect(result.body.error).toMatch(/credits are depleted/i)
    expect(calledModels()).toEqual([primary.model])
    expect(usageInserts).toEqual([
      expect.objectContaining({ model: primary.model, success: false, error_message: message }),
    ])
  })

  it('falls back to the next model when a model is gone (404)', async () => {
    generateContent
      .mockRejectedValueOnce(apiError(404, 'models/x is not found'))
      .mockResolvedValueOnce(ok())

    const result = await translateWithTimers()

    expect(result.status).toBe(200)
    expect(calledModels()).toEqual([primary.model, fallback.model])
  })

  it('reports when no model is available any more', async () => {
    generateContent.mockRejectedValue(apiError(404, 'not found'))

    const result = await translateWithTimers()

    expect(result.status).toBe(500)
    expect(result.body.error).toMatch(/no longer available/i)
    expect(generateContent).toHaveBeenCalledTimes(TRANSLATION_MODELS.length)
  })

  it('falls back to the next model when a model answers with malformed JSON', async () => {
    generateContent
      .mockResolvedValueOnce({ text: '{"sentencesSource": [\n 1. "Ich habe"' })
      .mockResolvedValueOnce(ok())

    const result = await translateWithTimers()

    expect(result).toEqual({ status: 200, body: validResult })
    expect(calledModels()).toEqual([primary.model, fallback.model])
    expect(usageInserts).toEqual([
      expect.objectContaining({ model: primary.model, success: false }),
      expect.objectContaining({ model: fallback.model, success: true }),
    ])
  })

  it('falls back to the next model when an answer lacks sentences', async () => {
    generateContent
      .mockResolvedValueOnce({ text: JSON.stringify({ ...validResult, sentencesGerman: [] }) })
      .mockResolvedValueOnce(ok())

    const result = await translateWithTimers()

    expect(result.status).toBe(200)
    expect(calledModels()).toEqual([primary.model, fallback.model])
  })

  it('reports an invalid response when no model answers usefully', async () => {
    generateContent.mockResolvedValue({ text: 'not json' })

    const result = await translateWithTimers()

    expect(result.status).toBe(500)
    expect(result.body.error).toMatch(/invalid translation response/i)
    expect(generateContent).toHaveBeenCalledTimes(TRANSLATION_MODELS.length)
  })

  it('falls back to the next model when a model takes too long, without retrying it', async () => {
    generateContent.mockImplementationOnce(hang).mockResolvedValueOnce(ok())

    const result = await translateWithTimers()

    expect(result.status).toBe(200)
    expect(calledModels()).toEqual([primary.model, fallback.model])
    expect(usageInserts[0]).toEqual(
      expect.objectContaining({ model: primary.model, success: false, error_message: expect.stringMatching(/timed out/) }),
    )
  })

  it('reports a timeout when every model takes too long', async () => {
    generateContent.mockImplementation(hang)

    const result = await translateWithTimers()

    expect(result.status).toBe(504)
    expect(result.body.error).toMatch(/took too long/i)
    expect(generateContent).toHaveBeenCalledTimes(TRANSLATION_MODELS.length)
  })

  it('keeps the worst case within the function time limit of 60 s', () => {
    // Each model's time limit covers all its attempts, backoff included
    const worstCase = TRANSLATION_MODELS.reduce((sum, m) => sum + m.timeoutMs, 0)
    expect(worstCase).toBeLessThan(60_000)
  })

  it('gives up on a model whose retries run past its time limit', async () => {
    generateContent.mockRejectedValueOnce(apiError(503, 'overloaded')).mockImplementationOnce(hang)
    generateContent.mockResolvedValueOnce(ok())

    const result = await translateWithTimers()

    expect(result.status).toBe(200)
    expect(calledModels()).toEqual([primary.model, primary.model, fallback.model])
  })

  it('retries an overloaded model (503) before succeeding', async () => {
    generateContent.mockRejectedValueOnce(apiError(503, 'overloaded')).mockResolvedValueOnce(ok())

    const result = await translateWithTimers()

    expect(result.status).toBe(200)
    expect(calledModels()).toEqual([primary.model, primary.model])
  })

  it('reports a busy service when every model is overloaded', async () => {
    generateContent.mockRejectedValue(apiError(429, 'rate limited'))

    const result = await translateWithTimers()

    expect(result.status).toBe(503)
    expect(result.body.error).toMatch(/temporarily busy/i)
    expect(generateContent).toHaveBeenCalledTimes(TRANSLATION_MODELS.length * 2)
  })
})
