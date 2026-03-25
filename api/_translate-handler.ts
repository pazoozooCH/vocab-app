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
  body: { word?: string; language?: string },
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

  const { word, language } = body
  if (!word || !language || !['EN', 'FR'].includes(language)) {
    return {
      status: 400,
      body: { error: 'Invalid request: word and language (EN/FR) required' },
    }
  }

  const sourceLang = language === 'EN' ? 'English' : 'French'

  const prompt = `Translate the ${sourceLang} word "${word}" to German.

Return a JSON object with exactly this structure:
{
  "translations": ["German translation 1", "German translation 2"],
  "sentencesSource": ["1. ${sourceLang} sentence with **${word}** bolded", "2. ${sourceLang} sentence with **${word}** bolded"],
  "sentencesGerman": ["1. German sentence with **translation** bolded", "2. German sentence with **translation** bolded"]
}

Rules:
- Include all common German translations (usually 1-3)
- Generate 2-3 sample sentences in ${sourceLang} and their German translations
- Number each sentence with an ordinal prefix (1., 2., 3.)
- Bold the vocabulary word in each sentence using **markdown bold**
- Use natural, everyday sentences${language === 'FR' ? '\n- French words must always include their article (un/une, le/la)' : ''}
- Return ONLY the JSON object, no other text`

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
          return { status: 500, body: { error: 'Invalid translation response structure' } }
        }

        return { status: 200, body: result }
      } catch (err: unknown) {
        const isRetryable =
          err instanceof Error &&
          'status' in err &&
          ((err as { status: number }).status === 503 ||
            (err as { status: number }).status === 429)

        if (isRetryable && attempt < MAX_RETRIES) {
          console.warn(`${model} unavailable (attempt ${attempt}/${MAX_RETRIES}), retrying...`)
          await new Promise((r) => setTimeout(r, attempt * 2000))
          continue
        }

        if (isRetryable && model !== models[models.length - 1]) {
          console.warn(`${model} unavailable after ${MAX_RETRIES} attempts, falling back to next model...`)
          break
        }

        console.error('Translation error:', err)

        if (isRetryable) {
          return {
            status: 503,
            body: { error: 'Translation service is temporarily busy. Please try again in a moment.' },
          }
        }
        return { status: 500, body: { error: 'Translation failed' } }
      }
    }
  }

  return { status: 500, body: { error: 'Translation failed' } }
}
