import { useMemo } from 'react'
import { AGENT_TYPES } from '../types.ts'
import type { TaskRecord } from '../types.ts'
import { computeAgentPlacements } from '../room/placement.ts'
import { AgentCharacter } from './room/AgentCharacter.tsx'

export type RoomViewProps = {
  task: TaskRecord
  className?: string
}

export function RoomView({ task, className }: RoomViewProps) {
  const placements = useMemo(() => computeAgentPlacements(task, true), [task])
  const loungeAgents = useMemo(
    () => AGENT_TYPES.filter((t) => placements[t].zone === 'lounge'),
    [placements],
  )
  const deskAgents = useMemo(
    () => AGENT_TYPES.filter((t) => placements[t].zone === 'desk'),
    [placements],
  )

  const rootClass = ['room-scene', className].filter(Boolean).join(' ')

  return (
    <section className={`panel room-view-panel ${rootClass}`} aria-label="Комната команды">
      <div className="room-view-inner">
        <header className="room-view-header">
          <h2>Офис</h2>
          <p>Рабочая зона и лаунж для задачи {task.taskId}</p>
        </header>

        <div className="room-openspace">
          <div className="room-zone room-zone--desk" aria-label="Рабочая зона">
            <div className="room-floor-strip room-floor-strip--desk" />
            <div className="room-desks">
              {[0, 1, 2].map((i) => (
                <div key={i} className="room-desk-unit">
                  <div className="room-monitor" />
                  <div className="room-desk-surface" />
                </div>
              ))}
            </div>
            <div className="room-desk-agents">
              {deskAgents.map((t) => (
                <AgentCharacter key={t} placement={placements[t]} />
              ))}
            </div>
          </div>

          <div className="room-zone room-zone--lounge" aria-label="Зона отдыха">
            <div className="room-floor-strip room-floor-strip--lounge" />
            <div className="room-lounge-decor">
              <div className="room-sofa" />
              <div className="room-rug" />
            </div>
            <div className="room-lounge-agents">
              {loungeAgents.map((t) => (
                <AgentCharacter key={t} placement={placements[t]} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
