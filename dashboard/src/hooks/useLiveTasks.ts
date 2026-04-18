import { useEffect, useState } from 'react'
import type { ConnectionState, TaskRecord, TasksPayload } from '../types.ts'

interface LiveTasksState {
  tasks: TaskRecord[]
  updatedAt: string | null
  isLoading: boolean
  error: string | null
  connectionState: ConnectionState
}

export function useLiveTasks(): LiveTasksState {
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')

  useEffect(() => {
    let isMounted = true
    let eventSource: EventSource | null = null

    const applyPayload = (payload: TasksPayload) => {
      if (!isMounted) {
        return
      }

      setTasks(payload.tasks)
      setUpdatedAt(payload.updatedAt)
      setError(null)
      setIsLoading(false)
    }

    const bootstrap = async () => {
      try {
        const response = await fetch('/api/tasks')
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const payload = (await response.json()) as TasksPayload
        applyPayload(payload)
      } catch (fetchError) {
        if (!isMounted) {
          return
        }

        const message =
          fetchError instanceof Error ? fetchError.message : 'Не удалось загрузить задачи'
        setError(message)
        setIsLoading(false)
      }

      if (!isMounted) {
        return
      }

      eventSource = new EventSource('/api/events')

      eventSource.addEventListener('update', (event) => {
        const payload = JSON.parse(event.data) as TasksPayload
        applyPayload(payload)
        setConnectionState('live')
      })

      eventSource.onopen = () => {
        if (!isMounted) {
          return
        }
        setConnectionState('live')
      }

      eventSource.onerror = () => {
        if (!isMounted) {
          return
        }
        setConnectionState('reconnecting')
      }
    }

    void bootstrap()

    return () => {
      isMounted = false
      eventSource?.close()
      setConnectionState('offline')
    }
  }, [])

  return {
    tasks,
    updatedAt,
    isLoading,
    error,
    connectionState,
  }
}
