import type { AgentRoomPlacement } from '../../room/placement.ts'
import { AGENT_LABELS, getExecutionStatusLabel, type AgentType } from '../../types.ts'

/** Координаты «пикселей» в сетке 10×16 (целые клетки). */
type Cell = readonly [number, number]

const BODY: Cell[] = [
  [4, 3],
  [5, 3],
  [3, 4],
  [4, 4],
  [5, 4],
  [6, 4],
  [4, 5],
  [5, 5],
  [4, 6],
  [5, 6],
  [3, 7],
  [4, 7],
  [5, 7],
  [6, 7],
  [3, 8],
  [6, 8],
  [2, 9],
  [3, 9],
  [6, 9],
  [7, 9],
  [2, 10],
  [3, 10],
  [6, 10],
  [7, 10],
  [3, 11],
  [4, 11],
  [5, 11],
  [6, 11],
]

function uniqCells(cells: Cell[]): Cell[] {
  const seen = new Set<string>()
  const out: Cell[] = []
  for (const [x, y] of cells) {
    const k = `${x},${y}`
    if (!seen.has(k)) {
      seen.add(k)
      out.push([x, y])
    }
  }
  return out
}

const PATTERNS: Record<AgentType, { cells: Cell[]; accent: Cell[] }> = {
  analysis: {
    cells: uniqCells([...BODY, [4, 2], [5, 2], [3, 3], [6, 3]]),
    accent: [
      [1, 4],
      [2, 5],
      [8, 4],
      [7, 5],
    ],
  },
  architect: {
    cells: uniqCells([...BODY, [4, 1], [5, 1], [4, 2], [5, 2], [3, 3], [6, 3]]),
    accent: [
      [4, 0],
      [5, 0],
    ],
  },
  development: {
    cells: uniqCells([...BODY, [3, 2], [4, 2], [5, 2], [6, 2]]),
    accent: [
      [2, 3],
      [7, 3],
      [1, 6],
      [8, 6],
    ],
  },
  'code-review': {
    cells: uniqCells([...BODY, [4, 2], [5, 2], [3, 3], [6, 3], [2, 4], [7, 4]]),
    accent: [
      [4, 1],
      [5, 1],
    ],
  },
  testing: {
    cells: uniqCells([...BODY, [3, 1], [4, 1], [5, 1], [6, 1], [2, 2], [7, 2]]),
    accent: [
      [4, 0],
      [5, 0],
      [3, 12],
      [6, 12],
    ],
  },
  'tech-writer': {
    cells: uniqCells([...BODY, [2, 2], [3, 2], [6, 2], [7, 2], [1, 5], [8, 5]]),
    accent: [
      [4, 1],
      [5, 1],
      [0, 7],
      [9, 7],
    ],
  },
}

export interface AgentCharacterProps {
  placement: AgentRoomPlacement
}

export function AgentCharacter({ placement }: AgentCharacterProps) {
  const { agentType, zone, activeExecutionStatus } = placement
  const pattern = PATTERNS[agentType]
  const label = AGENT_LABELS[agentType]
  const title =
    activeExecutionStatus !== null
      ? `${label} — ${getExecutionStatusLabel(activeExecutionStatus)}`
      : label

  return (
    <div
      className={`room-agent room-agent-${agentType} room-agent--${zone}`}
      title={title}
      role="img"
      aria-label={title}
    >
      <svg
        className="room-agent-sprite"
        viewBox="0 0 10 16"
        width="40"
        height="64"
        aria-hidden="true"
      >
        {pattern.cells.map(([x, y]) => (
          <rect key={`b-${x}-${y}`} x={x} y={y} width={1} height={1} className="room-agent-pixel room-agent-pixel--body" />
        ))}
        {pattern.accent.map(([x, y]) => (
          <rect key={`a-${x}-${y}`} x={x} y={y} width={1} height={1} className="room-agent-pixel room-agent-pixel--accent" />
        ))}
      </svg>
      <span className="room-agent-label">{label}</span>
      {zone === 'desk' && activeExecutionStatus !== null ? (
        <span className={`room-agent-badge status-${activeExecutionStatus}`}>{getExecutionStatusLabel(activeExecutionStatus)}</span>
      ) : null}
    </div>
  )
}
