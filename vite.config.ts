import { defineConfig, loadEnv, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'

function apiDevServer(): Plugin {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use('/api/translate', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        const chunks: Buffer[] = []
        for await (const chunk of req) {
          chunks.push(chunk as Buffer)
        }
        const body = JSON.parse(Buffer.concat(chunks).toString())

        // Load all env vars from .env into process.env so the handler
        // and its dependencies (Gemini SDK, Supabase) can read them
        const env = loadEnv('development', process.cwd(), '')
        Object.assign(process.env, env)

        const { handleTranslate } = await import('./api/_translate-handler')

        const result = await handleTranslate(
          body,
          req.headers.authorization,
          env.VITE_SUPABASE_URL ?? '',
          env.VITE_SUPABASE_ANON_KEY ?? '',
        )

        res.statusCode = result.status
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(result.body))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiDevServer()],
  server: {
    host: '127.0.0.1',
  },
  test: {
    globals: true,
    environment: 'node',
    exclude: ['e2e/**', 'node_modules/**'],
    fileParallelism: false,
    globalSetup: ['./src/infrastructure/supabase/testSetup.ts'],
  },
})
