import { useState, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei'
import { useTranslation } from 'react-i18next'

const SCALE = 0.05

function Wall({ from, to, height = 2.7 }) {
  const dx = (to[0] - from[0]) * SCALE
  const dz = (to[1] - from[1]) * SCALE
  const len = Math.sqrt(dx * dx + dz * dz)
  const angle = Math.atan2(dz, dx)
  const cx = ((from[0] + to[0]) / 2) * SCALE
  const cz = ((from[1] + to[1]) / 2) * SCALE

  return (
    <mesh position={[cx, height / 2, cz]} rotation={[0, -angle, 0]}>
      <boxGeometry args={[len, height, 0.15]} />
      <meshStandardMaterial color="#f5f0eb" />
    </mesh>
  )
}

function Room({ polygon, color, height = 0.02 }) {
  if (!polygon || polygon.length < 3) return null

  const xs = polygon.map(p => p[0] * SCALE)
  const zs = polygon.map(p => p[1] * SCALE)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minZ = Math.min(...zs), maxZ = Math.max(...zs)
  const w = maxX - minX
  const d = maxZ - minZ

  return (
    <mesh position={[(minX + maxX) / 2, height / 2, (minZ + maxZ) / 2]}>
      <boxGeometry args={[w, height, d]} />
      <meshStandardMaterial color={color} opacity={0.7} transparent />
    </mesh>
  )
}

function Furniture({ item }) {
  const w = (item.w || 20) * SCALE
  const d = (item.h || 20) * SCALE
  const h = 0.5
  const x = item.x * SCALE
  const z = item.y * SCALE

  return (
    <mesh position={[x + w / 2, h / 2, z + d / 2]}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color="#c4a882" />
    </mesh>
  )
}

function Scene({ plan }) {
  const wallHeight = plan.wall_height_m || 2.7

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} castShadow />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#f8f4f0" />
      </mesh>

      {plan.rooms?.map((room, i) => (
        <Room key={room.id || i} polygon={room.polygon} color={room.color} />
      ))}

      {plan.walls?.map((wall, i) => (
        <Wall key={i} from={wall.from} to={wall.to} height={wallHeight} />
      ))}

      {plan.furniture?.map((item, i) => (
        <Furniture key={i} item={item} />
      ))}
    </>
  )
}

export default function FloorPlanViewer({ plan }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState('orbit')

  if (!plan || (!plan.walls?.length && !plan.rooms?.length)) {
    return null
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  if (isMobile) {
    return (
      <div style={{ padding: 20, background: 'var(--fho-surface)', borderRadius: 'var(--r-md)', border: '0.5px solid var(--fho-border)', textAlign: 'center', color: 'var(--fho-text-muted)', fontSize: 13 }}>
        {t('floorPlan.desktopOnly')}
      </div>
    )
  }

  return (
    <div style={{ borderRadius: 'var(--r-md)', overflow: 'hidden', border: '0.5px solid var(--fho-border)' }}>
      <div style={{ display: 'flex', gap: 4, padding: 8, background: 'var(--fho-surface)', borderBottom: '0.5px solid var(--fho-border)' }}>
        {['orbit', 'top', 'iso'].map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={{ padding: '4px 12px', borderRadius: 6, border: mode === m ? 'none' : '0.5px solid var(--fho-border)', background: mode === m ? 'var(--fho-orange-2)' : 'transparent', color: mode === m ? 'white' : 'var(--fho-text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
            {m === 'orbit' ? t('floorPlan.orbit') : m === 'top' ? t('floorPlan.topView') : t('floorPlan.isoView')}
          </button>
        ))}
      </div>
      <div style={{ height: 350, background: '#f0ece8' }}>
        <Canvas shadows>
          <Suspense fallback={null}>
            {mode === 'top' && <PerspectiveCamera makeDefault position={[15, 25, 0]} fov={50} />}
            {mode === 'iso' && <PerspectiveCamera makeDefault position={[20, 15, 20]} fov={50} />}
            {mode === 'orbit' && <PerspectiveCamera makeDefault position={[15, 10, 15]} fov={50} />}
            <OrbitControls enablePan enableZoom enableRotate={mode === 'orbit'} />
            <Scene plan={plan} />
            <Environment preset="apartment" />
          </Suspense>
        </Canvas>
      </div>
    </div>
  )
}
