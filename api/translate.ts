import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleTranslate } from './_translate-handler'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
  const supabaseAnonKey =
    process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''

  const result = await handleTranslate(
    req.body,
    req.headers.authorization,
    supabaseUrl,
    supabaseAnonKey,
  )

  return res.status(result.status).json(result.body)
}
