import express from 'express'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import rootsRouter from './routes/roots.js'
import projectsRouter from './routes/projects.js'
import sessionsRouter from './routes/sessions.js'
import messagesRouter from './routes/messages.js'
import exportRouter from './routes/export.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export function createApp(): express.Application {
  const app = express()

  app.use(express.json())

  // API routes
  app.use('/api/roots', rootsRouter)
  app.use('/api/roots', projectsRouter)
  app.use('/api/roots', sessionsRouter)
  app.use('/api/roots', messagesRouter)
  app.use('/api/export', exportRouter)

  return app
}

export async function startServer(port: number, isDev: boolean): Promise<void> {
  const app = createApp()

  if (isDev) {
    // In dev mode, Vite handles frontend serving via its own dev server
    // The Express server only serves API routes
    // Vite proxies /api requests to this Express server
  } else {
    // In production, serve the built Vite output
    const distPath = resolve(__dirname, '..', '..', 'dist')
    app.use(express.static(distPath))
    app.get('*', (_req, res) => {
      res.sendFile(resolve(distPath, 'index.html'))
    })
  }

  return new Promise((resolve) => {
    app.listen(port, () => {
      console.log(`Claude Session Browser API running on http://localhost:${port}`)
      resolve()
    })
  })
}
