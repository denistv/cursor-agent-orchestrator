import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { load } from 'js-yaml'

/** Значения `agent_type` в YAML — только роли агентов. */
const AGENT_TYPES = ['analysis', 'architect', 'development', 'code-review', 'testing', 'tech-writer'] as const

/** Фазы UI/доски: очередь, этапы агентов, завершение (`new` — не agent_type). */
const PIPELINE_PHASES = ['new', ...AGENT_TYPES, 'done'] as const

type PipelinePhase = (typeof PIPELINE_PHASES)[number]
type AgentType = (typeof AGENT_TYPES)[number]
type ExecutionStatus = 'new' | 'in-progress' | 'done' | 'fail'

interface BoardTask {
  taskId: string
  phase: PipelinePhase
  description: string
}

interface RawExecution {
  id?: number
  parent_execution_id?: number | null
  /** Текущий формат в `orchestrator-protocol.md`. */
  agent_type?: string
  /** Устаревшее имя поля; читается только для обратной совместимости. */
  state?: string
  started_at?: string | null
  finished_at?: string | null
  output_data?: string
  status?: ExecutionStatus
}

interface RawTaskMemory {
  task_id?: string
  current_execution_id?: number | null
  started_at?: string | null
  finished_at?: string | null
  executions?: RawExecution[]
}

interface ParsedMemoryFile {
  fileName: string
  filePath: string
  raw: RawTaskMemory
}

interface ExecutionRecord {
  id: number
  parentExecutionId: number | null
  agentType: AgentType
  startedAt: string | null
  finishedAt: string | null
  outputData: string
  status: ExecutionStatus
  /** Следующий этап по истории: из дочернего execution или `done` после успешного tech-writer. */
  nextPhase: PipelinePhase | null
  isReturn: boolean
  isCurrent: boolean
}

export interface TaskRecord {
  taskId: string
  memoryFileName: string | null
  memoryFilePath: string | null
  memoryTaskId: string | null
  /** Отображаемая фаза: с доски или выведенная из памяти (текущий `agent_type` / завершение). */
  phase: PipelinePhase
  currentExecutionId: number | null
  startedAt: string | null
  finishedAt: string | null
  description: string
  executions: ExecutionRecord[]
}

export interface TasksPayload {
  tasks: TaskRecord[]
  updatedAt: string
}

const AGENT_INDEX = new Map<AgentType, number>(AGENT_TYPES.map((agentType, index) => [agentType, index]))

function isPipelinePhase(value: unknown): value is PipelinePhase {
  return typeof value === 'string' && PIPELINE_PHASES.includes(value as PipelinePhase)
}

function isAgentType(value: unknown): value is AgentType {
  return typeof value === 'string' && AGENT_TYPES.includes(value as AgentType)
}

function isExecutionStatus(value: unknown): value is ExecutionStatus {
  return value === 'new' || value === 'in-progress' || value === 'done' || value === 'fail'
}

function rawExecutionAgentType(execution: RawExecution): AgentType | null {
  const raw = execution.agent_type ?? execution.state
  return isAgentType(raw) ? raw : null
}

function parseTaskBoard(content: string): BoardTask[] {
  const lines = content.split(/\r?\n/)
  const tasks: BoardTask[] = []
  let currentTask: Partial<BoardTask> | null = null
  let isInsideHtmlComment = false

  const pushCurrentTask = () => {
    if (!currentTask?.taskId || !currentTask.phase || !currentTask.description) {
      return
    }

    tasks.push({
      taskId: currentTask.taskId,
      phase: currentTask.phase,
      description: currentTask.description,
    })
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (line.startsWith('<!--')) {
      isInsideHtmlComment = true
    }

    if (isInsideHtmlComment) {
      if (line.endsWith('-->')) {
        isInsideHtmlComment = false
      }
      continue
    }

    if (line.startsWith('## ')) {
      pushCurrentTask()
      currentTask = { taskId: line.slice(3).trim() }
      continue
    }

    if (!currentTask) {
      continue
    }

    if (line.startsWith('State:')) {
      const phase = line.slice('State:'.length).trim()
      if (isPipelinePhase(phase)) {
        currentTask.phase = phase
      }
      continue
    }

    if (line.startsWith('Description:')) {
      currentTask.description = line.slice('Description:'.length).trim()
    }
  }

  pushCurrentTask()
  return tasks
}

function deriveNextPhase(
  execution: RawExecution & { id: number },
  executions: Array<RawExecution & { id: number }>,
): PipelinePhase | null {
  const child = executions
    .filter((candidate) => candidate.parent_execution_id === execution.id)
    .sort((left, right) => (left.id ?? 0) - (right.id ?? 0))[0]

  const childAgentType = child ? rawExecutionAgentType(child) : null
  if (childAgentType) {
    return childAgentType
  }

  const selfType = rawExecutionAgentType(execution)
  if (execution.status === 'done' && selfType === 'tech-writer') {
    return 'done'
  }

  return null
}

function normalizeExecutions(
  executions: RawExecution[] | undefined,
  currentExecutionId: number | null,
): ExecutionRecord[] {
  const safeExecutions = [...(executions ?? [])].filter(
    (execution): execution is RawExecution & { id: number; status: ExecutionStatus } =>
      typeof execution.id === 'number' &&
      rawExecutionAgentType(execution) !== null &&
      isExecutionStatus(execution.status),
  )

  safeExecutions.sort((left, right) => left.id - right.id)

  return safeExecutions.map((execution) => {
    const agentType = rawExecutionAgentType(execution) as AgentType
    const nextPhase = deriveNextPhase(execution, safeExecutions)
    const currentIndex = AGENT_INDEX.get(agentType) ?? -1
    const nextIndex =
      nextPhase && nextPhase !== 'done' && nextPhase !== 'new' ? (AGENT_INDEX.get(nextPhase) ?? -1) : -1

    return {
      id: execution.id,
      parentExecutionId: typeof execution.parent_execution_id === 'number' ? execution.parent_execution_id : null,
      agentType,
      startedAt: execution.started_at ?? null,
      finishedAt: execution.finished_at ?? null,
      outputData: execution.output_data ?? '',
      status: execution.status,
      nextPhase,
      isReturn: nextPhase !== null && nextIndex > -1 && currentIndex > -1 && nextIndex < currentIndex,
      isCurrent: execution.id === currentExecutionId,
    }
  })
}

function derivePhaseFromMemory(memory: RawTaskMemory): PipelinePhase | null {
  if (memory.finished_at) {
    return 'done'
  }

  const executions = memory.executions ?? []
  if (executions.length === 0) {
    return 'new'
  }

  const currentId = typeof memory.current_execution_id === 'number' ? memory.current_execution_id : null
  if (currentId !== null) {
    const current = executions.find((execution) => execution.id === currentId)
    const agentType = current ? rawExecutionAgentType(current) : null
    if (agentType) {
      return agentType
    }
  }

  const sorted = [...executions]
    .filter((execution): execution is RawExecution & { id: number } => typeof execution.id === 'number')
    .sort((left, right) => left.id - right.id)
  const last = sorted.at(-1)
  const lastAgent = last ? rawExecutionAgentType(last) : null
  return lastAgent ?? 'new'
}

function resolveDisplayPhase(boardTask: BoardTask | null, memory: RawTaskMemory | null): PipelinePhase | null {
  const hasExecutions = Boolean(memory?.executions && memory.executions.length > 0)
  if (hasExecutions && memory) {
    return derivePhaseFromMemory(memory)
  }

  if (boardTask?.phase && isPipelinePhase(boardTask.phase)) {
    return boardTask.phase
  }

  if (memory) {
    return derivePhaseFromMemory(memory)
  }

  return null
}

async function readTaskMemoryFiles(baseDir: string): Promise<Map<string, ParsedMemoryFile>> {
  const fileNames = await readdir(baseDir)
  const memoryEntries = fileNames.filter((fileName) => /^TASK_MEMORY_[A-Za-z0-9]+\.yml$/.test(fileName))

  const entries = await Promise.all(
    memoryEntries.map(async (fileName) => {
      const filePath = join(baseDir, fileName)
      const raw = await readFile(filePath, 'utf-8')
      const parsed = load(raw) as RawTaskMemory | undefined

      if (!parsed || typeof parsed.task_id !== 'string' || parsed.task_id.trim() === '') {
        return null
      }

      return [
        fileName,
        {
          fileName,
          filePath,
          raw: parsed,
        },
      ] as const
    }),
  )

  const memories = new Map<string, ParsedMemoryFile>()

  for (const entry of entries) {
    if (entry) {
      memories.set(entry[0], entry[1])
    }
  }

  return memories
}

function getTaskMemoryFileName(taskId: string): string | null {
  const taskHex = taskId.split('-')[0]

  if (!taskHex) {
    return null
  }

  return `TASK_MEMORY_${taskHex}.yml`
}

function toTaskRecord(boardTask: BoardTask | null, memoryFile: ParsedMemoryFile | null): TaskRecord | null {
  const memory = memoryFile?.raw ?? null
  const taskId = boardTask?.taskId ?? memory?.task_id
  const displayPhase = resolveDisplayPhase(boardTask, memory)

  if (!taskId || !displayPhase || !isPipelinePhase(displayPhase)) {
    return null
  }

  const currentExecutionId =
    typeof memory?.current_execution_id === 'number' ? memory.current_execution_id : null

  return {
    taskId,
    memoryFileName: memoryFile?.fileName ?? null,
    memoryFilePath: memoryFile?.filePath ?? null,
    memoryTaskId: memory?.task_id ?? null,
    phase: displayPhase,
    currentExecutionId,
    startedAt: memory?.started_at ?? null,
    finishedAt: memory?.finished_at ?? null,
    description: boardTask?.description ?? '',
    executions: normalizeExecutions(memory?.executions, currentExecutionId),
  }
}

export async function getTasksPayload(baseDir: string): Promise<TasksPayload> {
  const taskBoardRaw = await readFile(join(baseDir, 'TaskBoard.md'), 'utf-8')
  const boardTasks = parseTaskBoard(taskBoardRaw)
  const memories = await readTaskMemoryFiles(baseDir)
  const tasks: TaskRecord[] = []

  for (const boardTask of boardTasks) {
    const expectedMemoryFileName = getTaskMemoryFileName(boardTask.taskId)
    const memoryFile = expectedMemoryFileName ? (memories.get(expectedMemoryFileName) ?? null) : null
    const task = toTaskRecord(boardTask, memoryFile)
    if (task) {
      tasks.push(task)
      if (expectedMemoryFileName) {
        memories.delete(expectedMemoryFileName)
      }
    }
  }

  for (const memoryFile of memories.values()) {
    const task = toTaskRecord(null, memoryFile)
    if (task) {
      tasks.push(task)
    }
  }

  return {
    tasks,
    updatedAt: new Date().toISOString(),
  }
}
