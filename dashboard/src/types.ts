/** Допустимые значения `agent_type` в YAML — только роли агентов, без `new`/`done`. */
export const AGENT_TYPES = [
  'analysis',
  'architect',
  'development',
  'code-review',
  'testing',
  'tech-writer',
] as const

export type AgentType = (typeof AGENT_TYPES)[number]

/**
 * Узлы графа маршрута (рёбра FSM) + синхронизация с `State:` на доске в парсере.
 * Подписи в UI для агентов — только через `AGENT_LABELS` и `agent_type` текущего execution.
 */
export const PIPELINE_PHASES = ['new', ...AGENT_TYPES, 'done'] as const

export type PipelinePhase = (typeof PIPELINE_PHASES)[number]

export type ExecutionStatus = 'new' | 'in-progress' | 'done' | 'fail'
export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline'
export type StatusTone = ExecutionStatus

export interface Execution {
  id: number
  parentExecutionId: number | null
  /** Соответствует полю `agent_type` в `memory/TASK_MEMORY_*.yml`. */
  agentType: AgentType
  startedAt: string | null
  finishedAt: string | null
  outputData: string
  status: ExecutionStatus
  /** Следующая фаза по истории (дочерний execution или `done` после tech-writer). */
  nextPhase: PipelinePhase | null
  isReturn: boolean
  isCurrent: boolean
}

export interface TaskRecord {
  taskId: string
  memoryFileName: string | null
  memoryFilePath: string | null
  memoryTaskId: string | null
  /** Сводка для графа/доски (парсер); чипы задач используют `current_execution_id` → `agent_type`. */
  phase: PipelinePhase
  currentExecutionId: number | null
  startedAt: string | null
  finishedAt: string | null
  description: string
  executions: Execution[]
}

export interface TasksPayload {
  tasks: TaskRecord[]
  updatedAt: string
}

export const AGENT_LABELS: Record<AgentType, string> = {
  analysis: 'Аналитик',
  architect: 'Архитектор',
  development: 'Разработчик',
  'code-review': 'Ревьювер',
  testing: 'Тестировщик',
  'tech-writer': 'Технический писатель',
}

/** Статус жизненного цикла execution в YAML (`status:`), не путать с `agent_type`. */
export const STATUS_LABELS: Record<ExecutionStatus, string> = {
  new: 'Ожидает',
  'in-progress': 'В процессе',
  done: 'Завершено',
  fail: 'Ошибка',
}

export function getCurrentExecution(task: TaskRecord): Execution | null {
  if (typeof task.currentExecutionId === 'number') {
    const match = task.executions.find((execution) => execution.id === task.currentExecutionId)
    if (match) {
      return match
    }
  }
  return task.executions.find((execution) => execution.isCurrent) ?? task.executions.at(-1) ?? null
}

/** Подпись для чипа: роль по `agent_type` текущего execution (`current_execution_id`), иначе «Готово» / «Не начато». */
export function getTaskChipLabel(task: TaskRecord): string {
  const current = getCurrentExecution(task)
  if (current) {
    return AGENT_LABELS[current.agentType]
  }
  if (task.finishedAt) {
    return 'Готово'
  }
  return 'Не начато'
}

export type TaskChipVariant = `agent-${AgentType}` | 'done' | 'idle'

/** Вариант оформления чипа: `agent-{agent_type}` | `done` | `idle`. */
export function getTaskChipVariant(task: TaskRecord): TaskChipVariant {
  const current = getCurrentExecution(task)
  if (current) {
    return `agent-${current.agentType}`
  }
  if (task.finishedAt) {
    return 'done'
  }
  return 'idle'
}

export function getTaskChipClassName(task: TaskRecord): string {
  return `exec-chip exec-${getTaskChipVariant(task)}`
}

/** Подпись узла маршрута: только `agent_type` или служебные «Старт» / «Готово» для краёв графа (не сущность «фаза»). */
export function routeEndpointLabel(id: PipelinePhase): string {
  if (id === 'new') {
    return 'Старт'
  }
  if (id === 'done') {
    return 'Готово'
  }
  return AGENT_LABELS[id]
}

/** Подпись роли агента для UI; для `new`/`done` без активного execution — «—». */
export function getDisplayedAgentRole(task: TaskRecord): string {
  const current = getCurrentExecution(task)
  if (current) {
    return AGENT_LABELS[current.agentType]
  }
  const phase = task.phase
  if (phase === 'new' || phase === 'done') {
    return '—'
  }
  return AGENT_LABELS[phase]
}

export interface TaskStatusMeta {
  tone: StatusTone
  label: string
  description: string
  isCompleted: boolean
  isInProgress: boolean
}

export function getExecutionStatusLabel(status: ExecutionStatus): string {
  return STATUS_LABELS[status]
}

export function getTaskStatusMeta(task: TaskRecord): TaskStatusMeta {
  const currentExecution = getCurrentExecution(task)

  if (task.phase === 'done') {
    return {
      tone: 'done',
      label: 'Задача завершена',
      description: 'Все этапы завершены, задача закрыта.',
      isCompleted: true,
      isInProgress: false,
    }
  }

  if (!currentExecution) {
    return {
      tone: 'new',
      label: 'Ожидает запуска',
      description: 'Execution ещё не создан, процесс не начат.',
      isCompleted: false,
      isInProgress: false,
    }
  }

  if (currentExecution.status === 'in-progress') {
    return {
      tone: 'in-progress',
      label: 'В процессе',
      description: `Сейчас работает агент: ${AGENT_LABELS[currentExecution.agentType]} (${currentExecution.agentType}).`,
      isCompleted: false,
      isInProgress: true,
    }
  }

  if (currentExecution.status === 'fail') {
    return {
      tone: 'fail',
      label: 'Требует внимания',
      description: 'Последний запуск завершился с ошибкой и требует разбора.',
      isCompleted: false,
      isInProgress: false,
    }
  }

  if (currentExecution.status === 'done') {
    return {
      tone: 'done',
      label: 'Этап завершён',
      description: currentExecution.nextPhase
        ? `Следующий шаг по маршруту: ${routeEndpointLabel(currentExecution.nextPhase)}.`
        : 'Текущий execution завершён, ожидается следующий.',
      isCompleted: false,
      isInProgress: false,
    }
  }

  return {
    tone: 'new',
    label: 'Ожидает запуска',
    description: `Текущий execution: ${AGENT_LABELS[currentExecution.agentType]}, статус «${STATUS_LABELS[currentExecution.status]}».`,
    isCompleted: false,
    isInProgress: false,
  }
}

export function hasMemory(task: TaskRecord): boolean {
  return task.memoryFileName !== null
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return '—'
  }

  return new Date(value).toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'medium',
  })
}

export function formatDuration(start: string | null, end: string | null): string {
  if (!start) {
    return '—'
  }

  const startMs = Date.parse(start)
  const endMs = Date.parse(end ?? new Date().toISOString())

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return '—'
  }

  const totalSeconds = Math.max(0, Math.round((endMs - startMs) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}ч ${minutes}м`
  }

  if (minutes > 0) {
    return `${minutes}м ${seconds}с`
  }

  return `${seconds}с`
}

export function getTaskEdgeKey(source: PipelinePhase, target: PipelinePhase): string {
  return `${source}->${target}`
}
