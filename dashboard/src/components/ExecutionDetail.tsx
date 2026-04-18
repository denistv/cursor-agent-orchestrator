import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  AGENT_LABELS,
  routeEndpointLabel,
  getExecutionStatusLabel,
  formatDateTime,
  formatDuration,
  type Execution,
} from '../types.ts'

interface ExecutionDetailProps {
  execution: Execution | null
}

export function ExecutionDetail({ execution }: ExecutionDetailProps) {
  if (!execution) {
    return (
      <section className="panel detail-panel empty-state">
        <h2>Execution details</h2>
        <p>Выберите execution слева, чтобы посмотреть результат работы агента.</p>
      </section>
    )
  }

  const duration = formatDuration(execution.startedAt, execution.finishedAt)
  const outputData = execution.outputData.trim()

  return (
    <section className="panel detail-panel">
      <div className="panel-header">
        <div>
          <h2>
            Execution #{execution.id} · {AGENT_LABELS[execution.agentType]}
          </h2>
          <p>{execution.nextPhase ? `Следующий шаг: ${routeEndpointLabel(execution.nextPhase)}` : 'Следующий шаг ещё не определён'}</p>
        </div>
        <span
          className={`status-chip status-${execution.status} ${execution.status === 'in-progress' ? 'is-live' : ''}`}
        >
          {getExecutionStatusLabel(execution.status)}
        </span>
      </div>

      <div className="detail-grid">
        <div className="detail-field">
          <span>parent_execution_id</span>
          <strong>{execution.parentExecutionId ?? 'null'}</strong>
        </div>
        <div className="detail-field">
          <span>started_at</span>
          <strong>{formatDateTime(execution.startedAt)}</strong>
        </div>
        <div className="detail-field">
          <span>finished_at</span>
          <strong>{formatDateTime(execution.finishedAt)}</strong>
        </div>
        <div className="detail-field">
          <span>duration</span>
          <strong>{duration}</strong>
        </div>
      </div>

      {outputData ? (
        <div className="markdown-body">
          <Markdown remarkPlugins={[remarkGfm]}>{outputData}</Markdown>
        </div>
      ) : (
        <div className="empty-markdown">
          <p>
            {execution.status === 'in-progress'
              ? 'Агент ещё работает, output_data пока пуст.'
              : 'Для этого execution output_data отсутствует.'}
          </p>
        </div>
      )}
    </section>
  )
}
