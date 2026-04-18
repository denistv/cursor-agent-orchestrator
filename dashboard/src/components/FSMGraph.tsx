import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react'
import { getTaskEdgeKey, routeEndpointLabel, PIPELINE_PHASES, type PipelinePhase, type TaskRecord } from '../types.ts'

interface FSMGraphProps {
  task: TaskRecord
}

const NODE_POSITIONS: Record<PipelinePhase, { x: number; y: number }> = {
  new: { x: 0, y: 0 },
  analysis: { x: 190, y: 0 },
  architect: { x: 380, y: 0 },
  development: { x: 570, y: 0 },
  'code-review': { x: 760, y: 0 },
  testing: { x: 950, y: 0 },
  'tech-writer': { x: 1140, y: 0 },
  done: { x: 1330, y: 0 },
}

const FSM_EDGES: Array<{ source: PipelinePhase; target: PipelinePhase }> = [
  { source: 'new', target: 'analysis' },
  { source: 'analysis', target: 'architect' },
  { source: 'architect', target: 'analysis' },
  { source: 'architect', target: 'development' },
  { source: 'development', target: 'architect' },
  { source: 'development', target: 'code-review' },
  { source: 'code-review', target: 'development' },
  { source: 'code-review', target: 'testing' },
  { source: 'testing', target: 'development' },
  { source: 'testing', target: 'tech-writer' },
  { source: 'tech-writer', target: 'done' },
]

const EDGE_LANES: Record<string, 0 | 1 | 2> = {
  'new->analysis': 0,
  'analysis->architect': 1,
  'architect->analysis': 0,
  'architect->development': 2,
  'development->architect': 1,
  'development->code-review': 0,
  'code-review->development': 2,
  'code-review->testing': 1,
  'testing->development': 0,
  'testing->tech-writer': 2,
  'tech-writer->done': 1,
}

const nodeTypes: NodeTypes = {
  fsmNode: FSMNode,
}

export function FSMGraph({ task }: FSMGraphProps) {
  const currentExecution = task.executions.find((execution) => execution.isCurrent) ?? null
  const visitedPhases = new Set<PipelinePhase>([task.phase])
  const donePhases = new Set<PipelinePhase>()
  const failedPhases = new Set<PipelinePhase>()
  const traversedEdges = new Set<string>()

  for (const execution of task.executions) {
    visitedPhases.add(execution.agentType)

    if (execution.nextPhase) {
      visitedPhases.add(execution.nextPhase)
      traversedEdges.add(getTaskEdgeKey(execution.agentType, execution.nextPhase))
    }

    if (execution.status === 'done') {
      donePhases.add(execution.agentType)
      if (execution.nextPhase) {
        donePhases.add(execution.nextPhase)
      }
    }

    if (execution.status === 'fail') {
      failedPhases.add(execution.agentType)
    }
  }

  const nodes: Node[] = PIPELINE_PHASES.map((phase) => ({
    id: phase,
    position: NODE_POSITIONS[phase],
    type: 'fsmNode',
    data: {
      label: routeEndpointLabel(phase),
      appearance: getNodeStyle({
        phase,
        isCurrentTaskPhase: task.phase === phase,
        isActiveExecution: currentExecution?.agentType === phase && currentExecution.status === 'in-progress',
        isDone: donePhases.has(phase),
        isFailed: failedPhases.has(phase),
        isVisited: visitedPhases.has(phase),
      }),
    },
  }))

  const edges: Edge[] = FSM_EDGES.map(({ source, target }) => {
    const edgeKey = getTaskEdgeKey(source, target)
    const isBackEdge = NODE_POSITIONS[source].x > NODE_POSITIONS[target].x
    const lane = EDGE_LANES[edgeKey] ?? 1
    const isTraversed = traversedEdges.has(edgeKey)
    const isActive =
      currentExecution !== null &&
      currentExecution.status === 'done' &&
      currentExecution.agentType === source &&
      currentExecution.nextPhase === target
    const isHighlighted = isTraversed || isActive
    const isActualReturn = isBackEdge && isHighlighted

    return {
      id: edgeKey,
      source,
      target,
      sourceHandle: getHandleId(isBackEdge ? 'top' : 'bottom', 'source', lane),
      targetHandle: getHandleId(isBackEdge ? 'top' : 'bottom', 'target', lane),
      type: 'smoothstep',
      animated: isTraversed || isActive,
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
      pathOptions: {
        borderRadius: isBackEdge ? 28 : 22,
        offset: getEdgeOffset(source, target, isBackEdge, lane),
      },
      style: {
        stroke: isActualReturn ? '#f87171' : isHighlighted ? '#60a5fa' : '#4b5563',
        strokeDasharray: isActualReturn ? '6 4' : undefined,
        strokeWidth: isHighlighted ? 3 : 1.5,
      },
    }
  })

  return (
    <section className="panel graph-panel">
      <div className="panel-header">
        <div>
          <h2>FSM flow</h2>
          <p>Текущее состояние задачи и история переходов по executions</p>
        </div>
        <div className="graph-legend" aria-label="Легенда графа">
          <span className="graph-legend-item">
            <span className="graph-legend-line neutral" aria-hidden="true" />
            Возможный переход
          </span>
          <span className="graph-legend-item">
            <span className="graph-legend-line traversed" aria-hidden="true" />
            Пройденный переход
          </span>
          <span className="graph-legend-item">
            <span className="graph-legend-line return" aria-hidden="true" />
            Возврат
          </span>
        </div>
      </div>

      <div className="graph-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          minZoom={0.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  )
}

interface FSMNodeData {
  label: string
  appearance: ReturnType<typeof getNodeStyle>
}

function FSMNode({ data }: NodeProps) {
  const nodeData = data as unknown as FSMNodeData

  return (
    <div style={nodeData.appearance}>
      {LANE_POSITIONS.map((left, lane) => (
        <Handle
          key={`top-target-${lane}`}
          id={getHandleId('top', 'target', lane as 0 | 1 | 2)}
          type="target"
          position={Position.Top}
          style={getHiddenHandleStyle(left)}
        />
      ))}
      {LANE_POSITIONS.map((left, lane) => (
        <Handle
          key={`top-source-${lane}`}
          id={getHandleId('top', 'source', lane as 0 | 1 | 2)}
          type="source"
          position={Position.Top}
          style={getHiddenHandleStyle(left)}
        />
      ))}
      {LANE_POSITIONS.map((left, lane) => (
        <Handle
          key={`bottom-target-${lane}`}
          id={getHandleId('bottom', 'target', lane as 0 | 1 | 2)}
          type="target"
          position={Position.Bottom}
          style={getHiddenHandleStyle(left)}
        />
      ))}
      {LANE_POSITIONS.map((left, lane) => (
        <Handle
          key={`bottom-source-${lane}`}
          id={getHandleId('bottom', 'source', lane as 0 | 1 | 2)}
          type="source"
          position={Position.Bottom}
          style={getHiddenHandleStyle(left)}
        />
      ))}
      {nodeData.label}
    </div>
  )
}

function getEdgeOffset(
  source: PipelinePhase,
  target: PipelinePhase,
  isBackEdge: boolean,
  lane: 0 | 1 | 2,
): number {
  const span = Math.abs(PIPELINE_PHASES.indexOf(source) - PIPELINE_PHASES.indexOf(target))

  if (isBackEdge) {
    return 52 + lane * 20 + span * 20
  }

  return 24 + lane * 16 + span * 8
}

function getHandleId(side: 'top' | 'bottom', kind: 'source' | 'target', lane: 0 | 1 | 2): string {
  return `${side}-${kind}-${lane}`
}

interface NodeStyleArgs {
  phase: PipelinePhase
  isCurrentTaskPhase: boolean
  isActiveExecution: boolean
  isDone: boolean
  isFailed: boolean
  isVisited: boolean
}

function getNodeStyle({
  phase,
  isCurrentTaskPhase,
  isActiveExecution,
  isDone,
  isFailed,
  isVisited,
}: NodeStyleArgs) {
  let background = '#111827'
  let border = '#374151'
  const color = '#f9fafb'
  let boxShadow = 'none'

  if (isVisited) {
    background = '#1f2937'
  }

  if (isDone) {
    background = '#052e16'
    border = '#22c55e'
  }

  if (isFailed) {
    background = '#450a0a'
    border = '#ef4444'
  }

  if (isCurrentTaskPhase) {
    background = '#172554'
    border = '#60a5fa'
    boxShadow = '0 0 0 4px rgba(96, 165, 250, 0.16)'
  }

  if (isActiveExecution) {
    background = '#0f172a'
    border = '#38bdf8'
    boxShadow = '0 0 0 4px rgba(56, 189, 248, 0.22)'
  }

  if (phase === 'done' && !isVisited) {
    background = '#111827'
    border = '#374151'
  }

  return {
    width: 150,
    textAlign: 'center' as const,
    borderRadius: 16,
    padding: 12,
    border: `2px solid ${border}`,
    background,
    color,
    fontWeight: 700,
    boxShadow,
  }
}

const LANE_POSITIONS = ['24%', '50%', '76%'] as const

function getHiddenHandleStyle(left: string) {
  return {
    ...hiddenHandleStyle,
    left,
  }
}

const hiddenHandleStyle = {
  opacity: 0,
  width: 10,
  height: 10,
  border: 'none',
  background: 'transparent',
  transform: 'translate(-50%, -50%)',
}
