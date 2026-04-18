import {
  getTaskChipClassName,
  getTaskChipLabel,
  getDisplayedAgentRole,
  getTaskStatusMeta,
  formatDateTime,
  hasMemory,
  type TaskRecord,
} from '../types.ts'

interface TaskSelectorProps {
  tasks: TaskRecord[]
  selectedTaskId: string | null
  onSelect: (taskId: string) => void
}

export function TaskSelector({ tasks, selectedTaskId, onSelect }: TaskSelectorProps) {
  return (
    <aside className="panel task-selector">
      <div className="panel-header">
        <div>
          <h2>Задачи</h2>
          <p>{tasks.length} шт.</p>
        </div>
      </div>

      <div className="task-list">
        {tasks.map((task) => {
          const taskStatus = getTaskStatusMeta(task)
          const isSelected = task.taskId === selectedTaskId

          return (
            <button
              key={task.taskId}
              className={`task-card ${isSelected ? 'selected' : ''} ${taskStatus.isInProgress ? 'is-live' : ''} ${taskStatus.isCompleted ? 'is-complete' : ''}`}
              onClick={() => onSelect(task.taskId)}
              type="button"
            >
              <div className="task-card-header">
                <strong>{task.taskId}</strong>
                <div className="task-card-statuses">
                  <span className={`status-chip ${getTaskChipClassName(task)}`}>{getTaskChipLabel(task)}</span>
                </div>
              </div>

              <p className="task-card-description">{task.description || 'Описание отсутствует'}</p>

              <div className="task-card-meta">
                <span>Агент: {getDisplayedAgentRole(task)}</span>
                <span>Execution: {task.currentExecutionId ?? '—'}</span>
                <span>Память: {hasMemory(task) ? task.memoryFileName : 'ещё не создана'}</span>
                <span>Старт: {formatDateTime(task.startedAt)}</span>
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
