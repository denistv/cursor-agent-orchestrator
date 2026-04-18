import {
  getTaskChipClassName,
  getTaskChipLabel,
  getDisplayedAgentRole,
  getTaskStatusMeta,
  formatDateTime,
  formatDuration,
  getCurrentExecution,
  hasMemory,
  type TaskRecord,
} from '../types.ts'

interface TaskSummaryProps {
  task: TaskRecord
}

export function TaskSummary({ task }: TaskSummaryProps) {
  const currentExecution = getCurrentExecution(task)
  const taskStatus = getTaskStatusMeta(task)
  const duration = formatDuration(task.startedAt, task.finishedAt)
  const memoryMismatch = task.memoryFileName !== null && task.memoryTaskId !== null && task.memoryTaskId !== task.taskId
  const agentSummary = getAgentSummary(task, currentExecution)
  const showStateChip = !(task.phase === 'done' && taskStatus.isCompleted)

  return (
    <section className="panel summary-panel">
      <div className="panel-header">
        <div>
          <h2>{task.taskId}</h2>
          <p>{task.description}</p>
        </div>
        <div className="summary-statuses">
          {showStateChip ? <span className={`status-chip ${getTaskChipClassName(task)}`}>{getTaskChipLabel(task)}</span> : null}
          <span
            className={`status-chip task-status-chip status-${taskStatus.tone} ${taskStatus.isInProgress ? 'is-live' : ''} ${taskStatus.isCompleted ? 'is-complete' : ''}`}
          >
            {taskStatus.isCompleted ? (
              <span className="status-check" aria-hidden="true">
                ✓
              </span>
            ) : null}
            {taskStatus.label}
          </span>
        </div>
      </div>

      <div
        className={`task-status-banner status-${taskStatus.tone} ${taskStatus.isInProgress ? 'is-live' : ''} ${taskStatus.isCompleted ? 'is-complete' : ''}`}
      >
        <strong>
          {taskStatus.isCompleted ? (
            <span className="status-check" aria-hidden="true">
              ✓
            </span>
          ) : null}
          {taskStatus.label}
        </strong>
        <span>{taskStatus.description}</span>
      </div>

      <div className="summary-grid">
        <article className="summary-card">
          <span className="summary-label">Текущий агент</span>
          <strong>{getDisplayedAgentRole(task)}</strong>
          <span>{agentSummary}</span>
        </article>

        <article className="summary-card">
          <span className="summary-label">Время</span>
          <strong>{duration}</strong>
          <span>
            {formatDateTime(task.startedAt)} → {formatDateTime(task.finishedAt)}
          </span>
        </article>

        <article className="summary-card">
          <span className="summary-label">История</span>
          <strong>{task.executions.length} executions</strong>
          <span>
            Возвраты: {task.executions.filter((execution) => execution.isReturn).length}
          </span>
        </article>

        <article className="summary-card">
          <span className="summary-label">Память задачи</span>
          <strong>{hasMemory(task) ? task.memoryFileName : 'Память ещё не создана'}</strong>
          <span>
            {hasMemory(task)
              ? memoryMismatch
                ? `task_id в YAML: ${task.memoryTaskId}`
                : `current_execution_id: ${task.currentExecutionId ?? 'null'}`
              : 'Executions появятся после создания TASK_MEMORY файла'}
          </span>
        </article>
      </div>
    </section>
  )
}

function getAgentSummary(task: TaskRecord, currentExecution: TaskRecord['executions'][number] | null): string {
  if (!currentExecution) {
    return 'Ожидает первый запуск'
  }

  if (task.phase === 'done') {
    return 'Задача закрыта'
  }

  if (currentExecution.status === 'in-progress') {
    return `Сейчас работает агент: ${getTaskChipLabel(task)}`
  }

  return `Текущий execution: ${getTaskChipLabel(task)}`
}
