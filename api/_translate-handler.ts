import { GoogleGenAI } from '@google/genai'
import { createClient } from '@supabase/supabase-js'

let ai: GoogleGenAI | null = null
function getAI(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  }
  return ai
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
- Number each sentence with an ordinal prefix (1., 2., 3.)
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

  // Retry and fallback strategy for Gemini's free tier:
  // 1. Try gemini-2.5-flash (better quality) with 2 attempts
  // 2. If 503 (overloaded) or 429 (rate limit), fall back to gemini-2.5-flash-lite
  //    which is faster, has higher free tier limits (1000 req/day vs 250), and lower demand
  // 3. Each model gets 2 attempts with exponential backoff (2s, 4s)
  // 4. Only return an error to the user if both models are exhausted
  const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite']
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
        const isRetryable =
          err instanceof Error &&
          'status' in err &&
          ((err as { status: number }).status === 503 ||
            (err as { status: number }).status === 429)

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
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        await logUsage(model, false, errMsg)
        return { status: 500, body: { error: 'Translation failed' } }
      }
    }
  }

  return { status: 500, body: { error: 'Translation failed' } }
}
