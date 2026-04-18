import { useMemo, useState } from 'react'
import './App.css'
import { ExecutionDetail } from './components/ExecutionDetail.tsx'
import { ExecutionTimeline } from './components/ExecutionTimeline.tsx'
import { FSMGraph } from './components/FSMGraph.tsx'
import { RoomView } from './components/RoomView.tsx'
import { TaskSelector } from './components/TaskSelector.tsx'
import { TaskSummary } from './components/TaskSummary.tsx'
import { useLiveTasks } from './hooks/useLiveTasks.ts'
import { formatDateTime, getCurrentExecution } from './types.ts'

type DashboardView = 'live' | 'room'

function App() {
  const { tasks, updatedAt, isLoading, error, connectionState } = useLiveTasks()
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedExecutionId, setSelectedExecutionId] = useState<number | null>(null)
  const [dashboardView, setDashboardView] = useState<DashboardView>('live')

  const resolvedTaskId = useMemo(() => {
    if (tasks.length === 0) {
      return null
    }

    if (selectedTaskId && tasks.some((task) => task.taskId === selectedTaskId)) {
      return selectedTaskId
    }

    return tasks[0].taskId
  }, [selectedTaskId, tasks])

  const selectedTask = useMemo(
    () => tasks.find((task) => task.taskId === resolvedTaskId) ?? null,
    [resolvedTaskId, tasks],
  )

  const resolvedExecutionId = useMemo(() => {
    if (!selectedTask) {
      return null
    }

    if (
      selectedExecutionId !== null &&
      selectedTask.executions.some((execution) => execution.id === selectedExecutionId)
    ) {
      return selectedExecutionId
    }

    return getCurrentExecution(selectedTask)?.id ?? null
  }, [selectedExecutionId, selectedTask])

  const selectedExecution = useMemo(() => {
    if (!selectedTask || resolvedExecutionId === null) {
      return null
    }

    return selectedTask.executions.find((execution) => execution.id === resolvedExecutionId) ?? null
  }, [resolvedExecutionId, selectedTask])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Dev Studio</p>
          <h1>Live Dashboard</h1>
          <p className="topbar-subtitle">
            Следит за `TaskBoard.md` и `TASK_MEMORY_*.yml`, показывает текущий flow и результат
            каждого execution.
          </p>
        </div>

        <div className="topbar-meta">
          <span className={`status-chip connection-${connectionState}`}>{connectionState}</span>
          <span>Updated: {formatDateTime(updatedAt)}</span>
        </div>
      </header>

      <div className="workspace">
        <TaskSelector
          tasks={tasks}
          selectedTaskId={selectedTask?.taskId ?? null}
          onSelect={setSelectedTaskId}
        />

        <main className="main-content">
          {isLoading ? (
            <section className="panel empty-state">
              <h2>Загрузка</h2>
              <p>Читаю `TaskBoard.md` и `TASK_MEMORY_*.yml`…</p>
            </section>
          ) : error ? (
            <section className="panel empty-state">
              <h2>Ошибка загрузки</h2>
              <p>{error}</p>
            </section>
          ) : !selectedTask ? (
            <section className="panel empty-state">
              <h2>Задачи не найдены</h2>
              <p>Добавьте запись в `TaskBoard.md`, чтобы dashboard начал её отслеживать.</p>
            </section>
          ) : (
            <>
              <div className="dashboard-view-toggle" role="group" aria-label="Режим отображения">
                <button
                  type="button"
                  className={`view-toggle-btn${dashboardView === 'live' ? ' is-active' : ''}`}
                  onClick={() => setDashboardView('live')}
                  aria-pressed={dashboardView === 'live'}
                >
                  Сводка
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn${dashboardView === 'room' ? ' is-active' : ''}`}
                  onClick={() => setDashboardView('room')}
                  aria-pressed={dashboardView === 'room'}
                >
                  Комната
                </button>
              </div>

              {dashboardView === 'live' ? (
                <>
                  <TaskSummary task={selectedTask} />

                  <div className="content-grid">
                    <FSMGraph task={selectedTask} />
                    <ExecutionTimeline
                      task={selectedTask}
                      selectedExecutionId={selectedExecution?.id ?? null}
                      onSelect={setSelectedExecutionId}
                    />
                  </div>

                  <ExecutionDetail execution={selectedExecution} />
                </>
              ) : (
                <RoomView task={selectedTask} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
