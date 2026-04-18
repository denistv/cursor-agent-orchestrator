import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import chokidar from 'chokidar'
import express, { type Response } from 'express'
import { getTasksPayload, type TasksPayload } from './parser.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const dataDir = join(__dirname, '..', '..')
const port = Number(process.env.PORT ?? 3001)

const app = express()
const clients = new Set<Response>()
const broadcastDebounceMs = 150
const broadcastRetryDelayMs = 250
const maxBroadcastAttempts = 3
let broadcastTimer: ReturnType<typeof setTimeout> | null = null

function writeEvent(response: Response, payload: TasksPayload) {
  response.write(`event: update\n`)
  response.write(`data: ${JSON.stringify(payload)}\n\n`)
}

async function loadPayload(): Promise<TasksPayload> {
  return getTasksPayload(dataDir)
}

async function broadcastUpdate(attempt = 1) {
  try {
    const payload = await loadPayload()
    for (const client of clients) {
      writeEvent(client, payload)
    }
  } catch (error) {
    if (attempt < maxBroadcastAttempts) {
      setTimeout(() => {
        void broadcastUpdate(attempt + 1)
      }, broadcastRetryDelayMs)
      return
    }

    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    process.stderr.write(`Failed to broadcast dashboard update: ${message}\n`)
  }
}

function scheduleBroadcastUpdate() {
  if (broadcastTimer) {
    clearTimeout(broadcastTimer)
  }

  // TASK_MEMORY files are rewritten atomically; waiting briefly avoids reading half-written YAML.
  broadcastTimer = setTimeout(() => {
    broadcastTimer = null
    void broadcastUpdate()
  }, broadcastDebounceMs)
}

app.get('/api/tasks', async (_request, response) => {
  response.json(await loadPayload())
})

app.get('/api/events', async (_request, response) => {
  response.setHeader('Content-Type', 'text/event-stream')
  response.setHeader('Cache-Control', 'no-cache, no-transform')
  response.setHeader('Connection', 'keep-alive')
  response.flushHeaders()

  clients.add(response)
  writeEvent(response, await loadPayload())

  const keepAlive = setInterval(() => {
    response.write(': keep-alive\n\n')
  }, 15000)

  response.on('close', () => {
    clearInterval(keepAlive)
    clients.delete(response)
    response.end()
  })
})

const httpServer = createServer(app)

const watcher = chokidar.watch([join(dataDir, 'TaskBoard.md'), join(dataDir, 'TASK_MEMORY_*.yml')], {
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 200,
    pollInterval: 50,
  },
})

watcher.on('add', scheduleBroadcastUpdate)
watcher.on('change', scheduleBroadcastUpdate)
watcher.on('unlink', scheduleBroadcastUpdate)

httpServer.listen(port, () => {
  process.stdout.write(`Dev Studio dashboard server is listening on http://localhost:${port}\n`)
})

async function shutdown(signal: string) {
  process.stdout.write(`Received ${signal}, shutting down dashboard server...\n`)
  if (broadcastTimer) {
    clearTimeout(broadcastTimer)
    broadcastTimer = null
  }
  await watcher.close()
  clients.forEach((client) => client.end())
  httpServer.close(() => process.exit(0))
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
