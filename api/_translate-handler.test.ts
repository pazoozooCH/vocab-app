import { ApiError } from '@google/genai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const generateContent = vi.fn()
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

function translate() {
  return handleTranslate({ word: 'house', language: 'EN' }, 'Bearer token', 'http://x', 'key')
}

/** Runs the handler while advancing fake timers through its backoff delays. */
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
    expect(TRANSLATION_MODELS).not.toContain('gemini-2.5-flash')
  })

  it('returns the translation from the first model', async () => {
    generateContent.mockResolvedValueOnce(ok())

    const result = await translateWithTimers()

    expect(result).toEqual({ status: 200, body: validResult })
    expect(generateContent).toHaveBeenCalledTimes(1)
    expect(generateContent.mock.calls[0][0].model).toBe(TRANSLATION_MODELS[0])
  })

  it('reports depleted credits (402) clearly, without retrying or falling back', async () => {
    const message =
      '{"error":{"code":402,"message":"Your prepayment credits are depleted.","status":"RESOURCE_EXHAUSTED"}}'
    generateContent.mockRejectedValue(apiError(402, message))

    const result = await translateWithTimers()

    expect(result.status).toBe(503)
    expect(result.body.error).toMatch(/credits are depleted/i)
    expect(generateContent).toHaveBeenCalledTimes(1)
    expect(usageInserts).toEqual([
      expect.objectContaining({ model: TRANSLATION_MODELS[0], success: false, error_message: message }),
    ])
  })

  it('falls back to the next model when a model is gone (404)', async () => {
    generateContent
      .mockRejectedValueOnce(apiError(404, 'models/x is not found'))
      .mockResolvedValueOnce(ok())

    const result = await translateWithTimers()

    expect(result.status).toBe(200)
    expect(generateContent).toHaveBeenCalledTimes(2)
    expect(generateContent.mock.calls[1][0].model).toBe(TRANSLATION_MODELS[1])
  })

  it('reports when no model is available any more', async () => {
    generateContent.mockRejectedValue(apiError(404, 'not found'))

    const result = await translateWithTimers()

    expect(result.status).toBe(500)
    expect(result.body.error).toMatch(/no longer available/i)
    expect(generateContent).toHaveBeenCalledTimes(TRANSLATION_MODELS.length)
  })

  it('retries an overloaded model (503) before succeeding', async () => {
    generateContent.mockRejectedValueOnce(apiError(503, 'overloaded')).mockResolvedValueOnce(ok())

    const result = await translateWithTimers()

    expect(result.status).toBe(200)
    expect(generateContent).toHaveBeenCalledTimes(2)
    expect(generateContent.mock.calls[1][0].model).toBe(TRANSLATION_MODELS[0])
  })

  it('reports a busy service when every model is overloaded', async () => {
    generateContent.mockRejectedValue(apiError(429, 'rate limited'))

    const result = await translateWithTimers()

    expect(result.status).toBe(503)
    expect(result.body.error).toMatch(/temporarily busy/i)
    expect(generateContent).toHaveBeenCalledTimes(TRANSLATION_MODELS.length * 2)
  })
})
