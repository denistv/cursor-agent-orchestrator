import {
  hasMemory,
  AGENT_LABELS,
  routeEndpointLabel,
  getExecutionStatusLabel,
  formatDateTime,
  type Execution,
  type TaskRecord,
} from '../types.ts'

interface ExecutionTimelineProps {
  task: TaskRecord
  selectedExecutionId: number | null
  onSelect: (executionId: number) => void
}

export function ExecutionTimeline({
  task,
  selectedExecutionId,
  onSelect,
}: ExecutionTimelineProps) {
  const hasTaskMemory = hasMemory(task)

  return (
    <section className="panel timeline-panel">
      <div className="panel-header">
        <div>
          <h2>Executions</h2>
          <p>
            {hasTaskMemory
              ? 'История запусков агентов по задаче'
              : 'Для этой задачи файл памяти ещё не создан'}
          </p>
        </div>
      </div>

      <div className="timeline-list">
        {task.executions.length === 0 ? (
          <div className="timeline-empty">
            <strong>{hasTaskMemory ? 'Executions пока отсутствуют' : 'Память ещё не создана'}</strong>
            <span>
              {hasTaskMemory
                ? 'Файл памяти найден, но executions ещё не добавлены.'
                : 'Как только оркестратор создаст memory/TASK_MEMORY_*.yml, здесь появится история execution.'}
            </span>
          </div>
        ) : (
          task.executions.map((execution) => {
            const isSelected = execution.id === selectedExecutionId

            return (
              <button
                key={execution.id}
                className={`timeline-item ${isSelected ? 'selected' : ''} ${execution.status === 'in-progress' ? 'is-live' : ''}`}
                onClick={() => onSelect(execution.id)}
                type="button"
              >
                <div className="timeline-icon-column">
                  <span className={`timeline-icon status-${execution.status}`} />
                  <span className="timeline-line" />
                </div>

                <div className="timeline-content">
                  <div className="timeline-header">
                    <strong>
                      #{execution.id} {AGENT_LABELS[execution.agentType]}
                    </strong>
                    <div className="timeline-badges">
                      {execution.isReturn ? <span className="mini-badge return">возврат</span> : null}
                      <span
                        className={`status-chip status-${execution.status} ${execution.status === 'in-progress' ? 'is-live' : ''}`}
                      >
                        {getExecutionStatusLabel(execution.status)}
                      </span>
                    </div>
                  </div>

                  <div className="timeline-meta">
                    <span>next: {execution.nextPhase ? routeEndpointLabel(execution.nextPhase) : 'awaiting result'}</span>
                    <span>parent: {formatParent(execution)}</span>
                    <span>start: {formatDateTime(execution.startedAt)}</span>
                    <span>finish: {formatDateTime(execution.finishedAt)}</span>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </section>
  )
}

function formatParent(execution: Execution): string {
  return execution.parentExecutionId === null ? 'null' : String(execution.parentExecutionId)
}
