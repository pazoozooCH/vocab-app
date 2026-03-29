import { defineConfig, type Plugin } from 'vitest/config'
import { loadEnv } from 'vite'
import { execSync } from 'child_process'
import react from '@vitejs/plugin-react'

function getCommitCount(): string {
  // Vercel uses shallow clones where git rev-list --count is wrong.
  // Use the GitHub API to get the real count — works for public repos.
  if (process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG) {
    try {
      const owner = process.env.VERCEL_GIT_REPO_OWNER
      const repo = process.env.VERCEL_GIT_REPO_SLUG
      const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? 'HEAD'
      // GitHub API: get commit, count via first page with per_page=1 and parse Link header
      const out = execSync(
        `curl -sI "https://api.github.com/repos/${owner}/${repo}/commits?sha=${sha}&per_page=1"`,
        { stdio: 'pipe' },
      ).toString()
      const match = out.match(/page=(\d+)>; rel="last"/)
      if (match) return match[1]
    } catch { /* fall through to git */ }
  }
  return execSync('git rev-list --count HEAD').toString().trim()
}

function getBuildInfo() {
  const commitCount = getCommitCount()
  const commitHash = process.env.VERCEL_GIT_COMMIT_SHA
    ?? execSync('git rev-parse HEAD').toString().trim()
  const shortHash = commitHash.slice(0, 7)
  const buildDate = new Date().toISOString().slice(0, 19).replace('T', ' ')
  return { commitCount, commitHash, shortHash, buildDate }
}

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

const buildInfo = getBuildInfo()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiDevServer()],
  define: {
    __BUILD_NUMBER__: JSON.stringify(buildInfo.commitCount),
    __BUILD_HASH__: JSON.stringify(buildInfo.commitHash),
    __BUILD_SHORT_HASH__: JSON.stringify(buildInfo.shortHash),
    __BUILD_DATE__: JSON.stringify(buildInfo.buildDate),
  },
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
