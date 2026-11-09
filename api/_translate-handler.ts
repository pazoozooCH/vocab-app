import { GoogleGenAI } from '@google/genai'
import { createClient } from '@supabase/supabase-js'

let ai: GoogleGenAI | null = null
function getAI(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  }
  return ai
}

// Retry and fallback strategy, in order of preference:
// 1. Try gemini-3.5-flash-lite, the successor of gemini-2.5-flash (shut down 2026-12-01)
// 2. If 503 (overloaded), 429 (rate limit), or 404 (model retired), fall back to
//    gemini-2.5-flash-lite, which is not deprecated
// 3. 503 and 429 get 2 attempts per model with backoff (2s); 404 falls back at once
// 4. 402 (prepaid credits depleted) fails at once: every model bills to the same project
export const TRANSLATION_MODELS = ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite']

/** The HTTP status of a Gemini SDK error (`ApiError`), if it has one. */
function errorStatus(err: unknown): number | undefined {
  if (err instanceof Error && 'status' in err && typeof err.status === 'number') {
    return err.status
  }
  return undefined
}

export async function handleTranslate(
  body: { word?: string; language?: string; context?: string },
  authHeader: string | undefined,
  supabaseUrl: string,
  supabaseAnonKey: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { status: 401, body: { error: 'Missing authorization header' } }
  }

  const token = authHeader.slice(7)
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return { status: 401, body: { error: 'Invalid token' } }
  }

  // Check email whitelist
  const { data: allowed } = await supabase
    .from('allowed_users')
    .select('email')
    .eq('email', user.email)
    .single()
  if (!allowed) {
    return { status: 403, body: { error: 'Not authorized' } }
  }

  const { word, language, context } = body
  if (!word || !language || !['EN', 'FR'].includes(language)) {
    return {
      status: 400,
      body: { error: 'Invalid request: word and language (EN/FR) required' },
    }
  }

  const sourceLang = language === 'EN' ? 'English' : 'French'

  const contextHint = context ? `\nContext: the meaning of "${word}" as in "${context}".` : ''

  const prompt = `Translate the ${sourceLang} word "${word}" to German.${contextHint}

Return a JSON object with exactly this structure:
{
  "word": "${word}",
  "translations": ["German translation 1 _[classifier]_", "German translation 2"],
  "sentencesSource": ["1. ${sourceLang} sentence with **${word}** bolded", "2. ${sourceLang} sentence with **${word}** bolded"],
  "sentencesGerman": ["1. German sentence with **translation** bolded", "2. German sentence with **translation** bolded"]
}

Rules:
- The "word" field should be the source word. If all translations share a domain-specific classifier (e.g. when context narrows the meaning), append it to the word too: e.g. "battery _[Law]_". If translations span multiple domains or are common everyday meanings, return the plain word without a classifier.
- Include all common German translations (usually 1-3)
- Where appropriate, add a domain/register classifier after the translation in italic markdown: _[Law]_, _[Med]_, _[Tech]_, _[Coll]_, _[Brit]_, _[Amer]_, _[Hist]_, _[Fig]_, _[Fin]_, etc. Only add classifiers when the meaning is domain-specific or register-specific — omit for common everyday meanings.
- Generate 2-3 sample sentences in ${sourceLang} and their German translations
- IMPORTANT: Every sentence MUST start with a number prefix: "1. ", "2. ", "3. ". This is required for both sentencesSource and sentencesGerman. Never omit the numbering.
- Bold the vocabulary word in each sentence using **markdown bold**
- Use natural, everyday sentences${language === 'FR' ? '\n- IMPORTANT: If the French word is a noun, the "word" field in the response MUST include the indefinite article (un/une). If the user entered just the noun without an article (e.g. "bus"), prepend it: "un bus". Always use un/une (not le/la) as they work for all nouns including those starting with a vowel (where le/la becomes l\').' : ''}
- Return ONLY the JSON object, no other text`

  // Log API usage to the database
  const logUsage = async (model: string, success: boolean, errorMessage?: string) => {
    try {
      await supabase.from('api_usage').insert({
        user_id: user.id,
        model,
        success,
        error_message: errorMessage ?? null,
      })
    } catch {
      // Don't fail the request if logging fails
    }
  }

  const models = TRANSLATION_MODELS
  const MAX_RETRIES = 2

  for (const model of models) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await getAI().models.generateContent({
          model,
          contents: prompt,
        })

        const text = response.text?.replace(/```json\n?|\n?```/g, '').trim()
        if (!text) {
          return { status: 500, body: { error: 'Empty response from Gemini' } }
        }

        const result = JSON.parse(text)

        if (
          !result.translations?.length ||
          !result.sentencesSource?.length ||
          !result.sentencesGerman?.length
        ) {
          await logUsage(model, false, 'Invalid translation response structure')
          return { status: 500, body: { error: 'Invalid translation response structure' } }
        }

        await logUsage(model, true)
        return { status: 200, body: result }
      } catch (err: unknown) {
        const status = errorStatus(err)
        const errMsg = err instanceof Error ? err.message : 'Unknown error'

        // Credits are billed per project, so no other model can succeed either
        if (status === 402) {
          console.error('Gemini credits depleted:', err)
          await logUsage(model, false, errMsg)
          return {
            status: 503,
            body: {
              error:
                'Gemini API credits are depleted. Top up the prepaid credits in AI Studio (ai.studio/projects).',
            },
          }
        }

        // The model was retired: retrying it is pointless, but the next one may work
        if (status === 404) {
          if (model !== models[models.length - 1]) {
            console.warn(`${model} is not available, falling back to next model...`)
            break
          }
          console.error('Translation error:', err)
          await logUsage(model, false, errMsg)
          return { status: 500, body: { error: 'Translation model is no longer available' } }
        }

        const isRetryable = status === 503 || status === 429

        // Retry with backoff if we have attempts left on this model
        if (isRetryable && attempt < MAX_RETRIES) {
          console.warn(`${model} unavailable (attempt ${attempt}/${MAX_RETRIES}), retrying...`)
          await new Promise((r) => setTimeout(r, attempt * 2000))
          continue
        }

        // Fall back to the next model if this one is persistently unavailable
        if (isRetryable && model !== models[models.length - 1]) {
          console.warn(`${model} unavailable after ${MAX_RETRIES} attempts, falling back to next model...`)
          break
        }

        console.error('Translation error:', err)

        // All models exhausted — return a user-friendly error
        if (isRetryable) {
          await logUsage(model, false, 'Service temporarily busy (503/429)')
          return {
            status: 503,
            body: { error: 'Translation service is temporarily busy. Please try again in a moment.' },
          }
        }
        await logUsage(model, false, errMsg)
        return { status: 500, body: { error: 'Translation failed' } }
      }
    }
  }

  return { status: 500, body: { error: 'Translation failed' } }
}
