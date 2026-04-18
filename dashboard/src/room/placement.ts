import { type AgentType, type ExecutionStatus, type TaskRecord, getCurrentExecution } from '../types.ts'

export type RoomZone = 'lounge' | 'desk'

export interface AgentRoomPlacement {
  agentType: AgentType
  zone: RoomZone
  /** Статус текущего execution, если этот агент за столом; иначе null */
  activeExecutionStatus: ExecutionStatus | null
}

export type AgentPlacementsMap = Record<AgentType, AgentRoomPlacement>

function emptyPlacement(agentType: AgentType): AgentRoomPlacement {
  return { agentType, zone: 'lounge', activeExecutionStatus: null }
}

function allLounge(): AgentPlacementsMap {
  return {
    analysis: emptyPlacement('analysis'),
    architect: emptyPlacement('architect'),
    development: emptyPlacement('development'),
    'code-review': emptyPlacement('code-review'),
    testing: emptyPlacement('testing'),
    'tech-writer': emptyPlacement('tech-writer'),
  }
}

function isTaskCompletedForRoom(task: TaskRecord): boolean {
  return task.phase === 'done' || task.finishedAt !== null
}

/**
 * @param task — выбранная задача; null = все в лаунже
 * @param sceneAllowed — false при loading/error или когда родитель намеренно не показывает сцену
 */
export function computeAgentPlacements(task: TaskRecord | null, sceneAllowed: boolean): AgentPlacementsMap {
  const map = allLounge()
  if (!sceneAllowed || task === null) {
    return map
  }
  if (isTaskCompletedForRoom(task)) {
    return map
  }
  const current = getCurrentExecution(task)
  if (!current || current.status !== 'in-progress') {
    return map
  }
  map[current.agentType] = {
    agentType: current.agentType,
    zone: 'desk',
    activeExecutionStatus: current.status,
  }
  return map
}
