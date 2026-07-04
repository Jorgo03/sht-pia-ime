import { useState, useRef, useCallback } from 'react'
import { Stage, Layer, Line, Rect, Circle, Text, Group } from 'react-konva'
import { useTranslation } from 'react-i18next'
import { getLocalizedText } from '../../../../lib/format'

const GRID_SIZE = 20
const SNAP = GRID_SIZE
const WALL_THICKNESS = 4
const COLORS = ['#FFE8DC', '#DCE8FF', '#DCEFD8', '#FFF4DC', '#F0DCE8', '#DCF0EE', '#E8E8E8', '#FDE8DC']
const FURNITURE = [
  { type: 'bed', w: 40, h: 30, label: 'Bed' },
  { type: 'sofa', w: 50, h: 20, label: 'Sofa' },
  { type: 'table', w: 24, h: 24, label: 'Table' },
  { type: 'chair', w: 14, h: 14, label: 'Chair' },
  { type: 'fridge', w: 16, h: 16, label: 'Fridge' },
  { type: 'sink', w: 14, h: 10, label: 'Sink' },
  { type: 'toilet', w: 12, h: 14, label: 'WC' },
  { type: 'shower', w: 20, h: 20, label: 'Shower' },
]

const snap = (v) => Math.round(v / SNAP) * SNAP

const emptyPlan = () => ({
  version: 1,
  scale_m_per_unit: 0.05,
  wall_height_m: 2.7,
  rooms: [],
  walls: [],
  doors: [],
  windows: [],
  furniture: [],
})

export default function FloorPlanEditor({ value, onChange }) {
  const { i18n } = useTranslation()
  const [plan, setPlan] = useState(value || emptyPlan())
  const [tool, setTool] = useState('wall')
  const [drawing, setDrawing] = useState(null)
  const [selected, setSelected] = useState(null)
  const stageRef = useRef(null)

  const updatePlan = useCallback((next) => {
    setPlan(next)
    onChange?.(next)
  }, [onChange])

  const handleStageClick = (e) => {
    const stage = stageRef.current
    const pos = stage.getRelativePointerPosition()
    const x = snap(pos.x)
    const y = snap(pos.y)

    if (tool === 'wall') {
      if (!drawing) {
        setDrawing({ from: [x, y] })
      } else {
        const newWall = { from: drawing.from, to: [x, y], thickness: WALL_THICKNESS * plan.scale_m_per_unit }
        updatePlan({ ...plan, walls: [...plan.walls, newWall] })
        setDrawing({ from: [x, y] })
      }
    } else if (tool === 'room') {
      const color = COLORS[plan.rooms.length % COLORS.length]
      const size = 80
      const room = {
        id: `r${Date.now()}`,
        name: { sq: 'Dhomë', en: 'Room' },
        polygon: [[x, y], [x + size, y], [x + size, y + size], [x, y + size]],
        color,
      }
      updatePlan({ ...plan, rooms: [...plan.rooms, room] })
    } else if (tool === 'furniture') {
      setSelected(null)
    }
  }

  const addFurniture = (furn) => {
    const item = {
      type: furn.type,
      x: 200,
      y: 200,
      w: furn.w,
      h: furn.h,
      rotation: 0,
    }
    updatePlan({ ...plan, furniture: [...plan.furniture, item] })
  }

  const handleDragEnd = (idx, e) => {
    const next = [...plan.furniture]
    next[idx] = { ...next[idx], x: snap(e.target.x()), y: snap(e.target.y()) }
    updatePlan({ ...plan, furniture: next })
  }

  const deleteFurniture = (idx) => {
    updatePlan({ ...plan, furniture: plan.furniture.filter((_, i) => i !== idx) })
    setSelected(null)
  }

  const deleteWall = (idx) => {
    updatePlan({ ...plan, walls: plan.walls.filter((_, i) => i !== idx) })
  }

  const clearAll = () => {
    updatePlan(emptyPlan())
    setDrawing(null)
    setSelected(null)
  }

  const stageW = 600
  const stageH = 400

  return (
    <div style={{ border: '0.5px solid var(--fho-border)', borderRadius: 'var(--r-md)', overflow: 'hidden', background: 'white' }}>
      <div style={{ display: 'flex', gap: 4, padding: 8, background: 'var(--fho-surface)', borderBottom: '0.5px solid var(--fho-border)', flexWrap: 'wrap' }}>
        {['wall', 'room'].map(t => (
          <button key={t} onClick={() => { setTool(t); setDrawing(null) }}
            style={{ padding: '4px 12px', borderRadius: 6, border: tool === t ? 'none' : '0.5px solid var(--fho-border)', background: tool === t ? 'var(--fho-orange-2)' : 'transparent', color: tool === t ? 'white' : 'var(--fho-text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
        <div style={{ width: 1, background: 'var(--fho-border)', margin: '0 4px' }} />
        {FURNITURE.map(f => (
          <button key={f.type} onClick={() => addFurniture(f)}
            style={{ padding: '4px 10px', borderRadius: 6, border: '0.5px solid var(--fho-border)', background: 'transparent', color: 'var(--fho-text)', fontSize: 11, cursor: 'pointer' }}>
            + {f.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {drawing && <button onClick={() => setDrawing(null)} style={{ padding: '4px 10px', borderRadius: 6, border: '0.5px solid var(--fho-border)', background: 'transparent', color: '#e74c3c', fontSize: 11, cursor: 'pointer' }}>Stop drawing</button>}
        <button onClick={clearAll} style={{ padding: '4px 10px', borderRadius: 6, border: '0.5px solid var(--fho-border)', background: 'transparent', color: '#e74c3c', fontSize: 11, cursor: 'pointer' }}>Clear</button>
      </div>

      <Stage ref={stageRef} width={stageW} height={stageH} onClick={handleStageClick} style={{ cursor: tool === 'wall' ? 'crosshair' : 'default' }}>
        <Layer>
          {Array.from({ length: Math.ceil(stageW / GRID_SIZE) }, (_, i) => (
            <Line key={`v${i}`} points={[i * GRID_SIZE, 0, i * GRID_SIZE, stageH]} stroke="#eee" strokeWidth={0.5} />
          ))}
          {Array.from({ length: Math.ceil(stageH / GRID_SIZE) }, (_, i) => (
            <Line key={`h${i}`} points={[0, i * GRID_SIZE, stageW, i * GRID_SIZE]} stroke="#eee" strokeWidth={0.5} />
          ))}

          {plan.rooms.map((room, i) => (
            <Group key={room.id}>
              <Line points={room.polygon.flat()} closed fill={room.color} stroke="#999" strokeWidth={1} opacity={0.6} />
              <Text text={getLocalizedText(room.name, i18n.language) || `Room ${i + 1}`}
                x={room.polygon[0][0] + 4} y={room.polygon[0][1] + 4}
                fontSize={11} fill="#666" />
            </Group>
          ))}

          {plan.walls.map((wall, i) => (
            <Line key={`w${i}`} points={[...wall.from, ...wall.to]}
              stroke="#333" strokeWidth={WALL_THICKNESS} lineCap="round"
              onClick={(e) => { e.cancelBubble = true; deleteWall(i) }}
              hitStrokeWidth={10} />
          ))}

          {drawing && (
            <Circle x={drawing.from[0]} y={drawing.from[1]} radius={4} fill="var(--fho-orange-2)" />
          )}

          {plan.furniture.map((f, i) => (
            <Group key={i} x={f.x} y={f.y} draggable
              onDragEnd={(e) => handleDragEnd(i, e)}
              onClick={(e) => { e.cancelBubble = true; setSelected(i) }}
              onDblClick={(e) => { e.cancelBubble = true; deleteFurniture(i) }}>
              <Rect width={f.w} height={f.h} fill={selected === i ? '#FFD4B8' : '#E8E8E8'} stroke={selected === i ? '#FF6B00' : '#999'} strokeWidth={1} cornerRadius={2} />
              <Text text={f.type} x={2} y={f.h / 2 - 5} fontSize={9} fill="#666" />
            </Group>
          ))}
        </Layer>
      </Stage>

      {selected !== null && (
        <div style={{ padding: 8, background: 'var(--fho-surface)', borderTop: '0.5px solid var(--fho-border)', fontSize: 12 }}>
          Selected: {plan.furniture[selected]?.type} — double-click to delete
        </div>
      )}
    </div>
  )
}
