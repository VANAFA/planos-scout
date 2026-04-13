import { MouseEvent, useMemo, useState } from 'react'
import './App.css'

type Vec3 = { x: number; y: number; z: number }
type TipoElemento = 'palo' | 'soga' | 'cana'
type Lado = 'norte' | 'sur' | 'este' | 'oeste' | 'arriba' | 'abajo'
type BrushMode = 'ninguno' | 'palo' | 'nudo'

interface Elemento {
  id: number
  tipo: TipoElemento
  p1: Vec3
  p2: Vec3
  color: string
  etiqueta: string
}

interface Interseccion {
  id: number
  elementoAId: number
  elementoBId: number
  lado: Lado
  desfase: number
  amarreTipo: string
  paso: number
}

interface Paso {
  numero: number
  comentario: string
  rotX: number
  rotZ: number
}

const ladoVector: Record<Lado, Vec3> = {
  norte: { x: 0, y: 1, z: 0 },
  sur: { x: 0, y: -1, z: 0 },
  este: { x: 1, y: 0, z: 0 },
  oeste: { x: -1, y: 0, z: 0 },
  arriba: { x: 0, y: 0, z: 1 },
  abajo: { x: 0, y: 0, z: -1 },
}

const lados: Lado[] = ['norte', 'sur', 'este', 'oeste', 'arriba', 'abajo']
const GRID_STEP = 0.5

function rotarPunto(p: Vec3, centro: Vec3, rotXDeg: number, rotZDeg: number): Vec3 {
  const rx = (rotXDeg * Math.PI) / 180
  const rz = (rotZDeg * Math.PI) / 180
  const px = p.x - centro.x
  const py = p.y - centro.y
  const pz = p.z - centro.z

  const xz = px * Math.cos(rz) - py * Math.sin(rz)
  const yz = px * Math.sin(rz) + py * Math.cos(rz)
  const zz = pz

  const xx = xz
  const yx = yz * Math.cos(rx) - zz * Math.sin(rx)
  const zx = yz * Math.sin(rx) + zz * Math.cos(rx)

  return { x: xx + centro.x, y: yx + centro.y, z: zx + centro.z }
}

function proyectarIsometrico(p: Vec3): { x: number; y: number } {
  return { x: p.x + p.y * 0.45, y: -p.z + p.y * 0.2 }
}

function puntoInterseccionAproximado(a1: Vec3, a2: Vec3, b1: Vec3, b2: Vec3): Vec3 {
  const pa = { x: (a1.x + a2.x) / 2, y: (a1.y + a2.y) / 2, z: (a1.z + a2.z) / 2 }
  const pb = { x: (b1.x + b2.x) / 2, y: (b1.y + b2.y) / 2, z: (b1.z + b2.z) / 2 }
  return { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2, z: (pa.z + pb.z) / 2 }
}

function snap(valor: number) {
  return Math.round(valor / GRID_STEP) * GRID_STEP
}

export default function AppBrush() {
  const [elementos, setElementos] = useState<Elemento[]>([])
  const [intersecciones, setIntersecciones] = useState<Interseccion[]>([])
  const [pasos, setPasos] = useState<Paso[]>([
    { numero: 1, comentario: '', rotX: 0, rotZ: 0 },
    { numero: 2, comentario: '', rotX: 0, rotZ: 0 },
  ])
  const [pasoVista, setPasoVista] = useState(1)
  const [jsonTexto, setJsonTexto] = useState('')

  const [brush, setBrush] = useState<BrushMode>('ninguno')
  const [inicioPalo, setInicioPalo] = useState<Vec3 | null>(null)
  const [seleccionNudo, setSeleccionNudo] = useState<number[]>([])

  const [formElemento, setFormElemento] = useState({
    tipo: 'palo' as TipoElemento,
    etiqueta: '',
    color: '#ff8a00',
    p1z: 0,
    p2z: 0,
  })

  const [formInter, setFormInter] = useState({
    lado: 'norte' as Lado,
    desfase: 0.08,
    amarreTipo: 'Cuadrado',
    paso: 1,
  })

  const nextElementoId = useMemo(
    () => (elementos.length ? Math.max(...elementos.map((e) => e.id)) + 1 : 1),
    [elementos],
  )
  const nextInterId = useMemo(
    () => (intersecciones.length ? Math.max(...intersecciones.map((i) => i.id)) + 1 : 1),
    [intersecciones],
  )

  const centro = useMemo<Vec3>(() => {
    if (!elementos.length) return { x: 0, y: 0, z: 0 }
    const pts = elementos.flatMap((e) => [e.p1, e.p2])
    return {
      x: pts.reduce((acc, p) => acc + p.x, 0) / pts.length,
      y: pts.reduce((acc, p) => acc + p.y, 0) / pts.length,
      z: pts.reduce((acc, p) => acc + p.z, 0) / pts.length,
    }
  }, [elementos])

  const rotacionAcumulada = useMemo(() => {
    const ordenados = [...pasos].sort((a, b) => a.numero - b.numero)
    let x = 0
    let z = 0
    for (const p of ordenados) {
      if (p.numero <= pasoVista) {
        if (Number.isFinite(p.rotX)) x = p.rotX
        if (Number.isFinite(p.rotZ)) z = p.rotZ
      }
    }
    return { x, z }
  }, [pasos, pasoVista])

  const idsPreviosYActuales = useMemo(() => {
    const prev = new Set<number>()
    const actual = new Set<number>()
    for (const it of intersecciones) {
      if (it.paso < pasoVista) {
        prev.add(it.elementoAId)
        prev.add(it.elementoBId)
      }
      if (it.paso === pasoVista) {
        actual.add(it.elementoAId)
        actual.add(it.elementoBId)
      }
    }
    for (const id of actual) prev.delete(id)
    return { prev, actual }
  }, [intersecciones, pasoVista])

  const previewData = useMemo(() => {
    const visibles = elementos.filter(
      (e) => idsPreviosYActuales.prev.has(e.id) || idsPreviosYActuales.actual.has(e.id),
    )

    const lineas = visibles.map((e) => {
      const p1r = rotarPunto(e.p1, centro, rotacionAcumulada.x, rotacionAcumulada.z)
      const p2r = rotarPunto(e.p2, centro, rotacionAcumulada.x, rotacionAcumulada.z)
      const p1 = proyectarIsometrico(p1r)
      const p2 = proyectarIsometrico(p2r)
      return {
        ...e,
        p1,
        p2,
        colorRender: idsPreviosYActuales.actual.has(e.id) ? '#ff8a00' : '#9e9e9e',
      }
    })

    const nudos = intersecciones
      .filter((inter) => inter.paso <= pasoVista)
      .map((inter) => {
        const a = elementos.find((e) => e.id === inter.elementoAId)
        const b = elementos.find((e) => e.id === inter.elementoBId)
        if (!a || !b) return null
        const base = puntoInterseccionAproximado(a.p1, a.p2, b.p1, b.p2)
        const vec = ladoVector[inter.lado]
        const p = {
          x: base.x + vec.x * inter.desfase,
          y: base.y + vec.y * inter.desfase,
          z: base.z + vec.z * inter.desfase,
        }
        const pr = rotarPunto(p, centro, rotacionAcumulada.x, rotacionAcumulada.z)
        const pp = proyectarIsometrico(pr)
        return { ...inter, p: pp, color: inter.paso === pasoVista ? '#6d4c41' : '#616161' }
      })
      .filter(Boolean) as Array<Interseccion & { p: { x: number; y: number }; color: string }>

    const allPoints = [...lineas.flatMap((l) => [l.p1, l.p2]), ...nudos.map((n) => n.p), { x: 0, y: 0 }]
    const minX = Math.min(...allPoints.map((p) => p.x))
    const maxX = Math.max(...allPoints.map((p) => p.x))
    const minY = Math.min(...allPoints.map((p) => p.y))
    const maxY = Math.max(...allPoints.map((p) => p.y))

    const width = 900
    const height = 520
    const margin = 32
    const sx = (width - margin * 2) / Math.max(maxX - minX, 0.0001)
    const sy = (height - margin * 2) / Math.max(maxY - minY, 0.0001)
    const scale = Math.min(sx, sy)

    const map = (p: { x: number; y: number }) => ({
      x: margin + (p.x - minX) * scale,
      y: margin + (p.y - minY) * scale,
    })

    const unmap = (sxValue: number, syValue: number) => ({
      x: minX + (sxValue - margin) / scale,
      y: minY + (syValue - margin) / scale,
    })

    const gridLines: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
    const startX = Math.floor(minX / GRID_STEP) * GRID_STEP - GRID_STEP
    const endX = Math.ceil(maxX / GRID_STEP) * GRID_STEP + GRID_STEP
    const startY = Math.floor(minY / GRID_STEP) * GRID_STEP - GRID_STEP
    const endY = Math.ceil(maxY / GRID_STEP) * GRID_STEP + GRID_STEP

    for (let gx = startX; gx <= endX; gx += GRID_STEP) {
      const p1 = map({ x: gx, y: startY })
      const p2 = map({ x: gx, y: endY })
      gridLines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y })
    }
    for (let gy = startY; gy <= endY; gy += GRID_STEP) {
      const p1 = map({ x: startX, y: gy })
      const p2 = map({ x: endX, y: gy })
      gridLines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y })
    }

    return {
      width,
      height,
      lineas: lineas.map((l) => ({ ...l, p1s: map(l.p1), p2s: map(l.p2) })),
      nudos: nudos.map((n) => ({ ...n, ps: map(n.p) })),
      map,
      unmap,
      gridLines,
    }
  }, [elementos, intersecciones, idsPreviosYActuales, pasoVista, centro, rotacionAcumulada])

  function agregarElementoDesde(p1: Vec3, p2: Vec3) {
    const nuevo: Elemento = {
      id: nextElementoId,
      tipo: formElemento.tipo,
      etiqueta: formElemento.etiqueta || `${formElemento.tipo}-${nextElementoId}`,
      color: formElemento.color,
      p1,
      p2,
    }
    setElementos((prev) => [...prev, nuevo])
  }

  function agregarInterseccionCon(aId: number, bId: number) {
    if (!aId || !bId || aId === bId) return
    const nueva: Interseccion = {
      id: nextInterId,
      elementoAId: aId,
      elementoBId: bId,
      lado: formInter.lado,
      desfase: formInter.desfase,
      amarreTipo: formInter.amarreTipo,
      paso: formInter.paso,
    }
    setIntersecciones((prev) => [...prev, nueva])
    if (!pasos.find((p) => p.numero === formInter.paso)) {
      setPasos((prev) => [...prev, { numero: formInter.paso, comentario: '', rotX: 0, rotZ: 0 }])
    }
  }

  function updatePaso(numero: number, patch: Partial<Paso>) {
    setPasos((prev) => prev.map((p) => (p.numero === numero ? { ...p, ...patch } : p)))
  }

  function exportarJson() {
    const payload = { elementos, intersecciones, pasos: [...pasos].sort((a, b) => a.numero - b.numero) }
    const text = JSON.stringify(payload, null, 2)
    setJsonTexto(text)
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'proyecto_scout_ui.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function importarJson() {
    try {
      const data = JSON.parse(jsonTexto)
      if (!Array.isArray(data.elementos) || !Array.isArray(data.intersecciones) || !Array.isArray(data.pasos)) {
        alert('JSON inválido: se esperaba { elementos[], intersecciones[], pasos[] }')
        return
      }
      setElementos(data.elementos)
      setIntersecciones(data.intersecciones)
      setPasos(data.pasos)
      setInicioPalo(null)
      setSeleccionNudo([])
    } catch {
      alert('JSON inválido')
    }
  }

  function activarBrush(mode: BrushMode) {
    setBrush((prev) => (prev === mode ? 'ninguno' : mode))
    setInicioPalo(null)
    setSeleccionNudo([])
  }

  function clickCanvas(e: MouseEvent<SVGSVGElement>) {
    if (brush !== 'palo') return
    const rect = e.currentTarget.getBoundingClientRect()
    const scaleX = previewData.width / rect.width
    const scaleY = previewData.height / rect.height
    const sx = (e.clientX - rect.left) * scaleX
    const sy = (e.clientY - rect.top) * scaleY

    const world2d = previewData.unmap(sx, sy)
    const p = { x: snap(world2d.x), y: snap(world2d.y), z: formElemento.p1z }

    if (!inicioPalo) {
      setInicioPalo(p)
      return
    }

    agregarElementoDesde(inicioPalo, { ...p, z: formElemento.p2z })
    setInicioPalo(null)
  }

  function clickLinea(id: number) {
    if (brush !== 'nudo') return
    setSeleccionNudo((prev) => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      if (next.length < 2) return next
      agregarInterseccionCon(next[0], next[1])
      return []
    })
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>Diseñador Scout</h2>

        <section className="panel">
          <h3>Pinceles</h3>
          <div className="brushRow">
            <button className={brush === 'palo' ? 'active' : ''} onClick={() => activarBrush('palo')}>Pincel de palos</button>
            <button className={brush === 'nudo' ? 'active' : ''} onClick={() => activarBrush('nudo')}>Pincel de nudos</button>
            <button className={brush === 'ninguno' ? 'active' : ''} onClick={() => activarBrush('ninguno')}>Sin pincel</button>
          </div>
          <p className="hint">
            {brush === 'palo' && (inicioPalo ? 'Segundo click para terminar el palo.' : 'Click para iniciar palo.')}
            {brush === 'nudo' && (seleccionNudo.length ? 'Seleccioná segundo palo para crear nudo.' : 'Seleccioná dos palos.')}
            {brush === 'ninguno' && 'Elegí un pincel para construir desde el preview.'}
          </p>
        </section>

        <section className="panel">
          <h3>Elemento</h3>
          <div className="grid2">
            <label>Tipo</label>
            <select value={formElemento.tipo} onChange={(e) => setFormElemento((p) => ({ ...p, tipo: e.target.value as TipoElemento }))}>
              <option value="palo">palo</option>
              <option value="cana">caña</option>
              <option value="soga">soga</option>
            </select>
            <label>Etiqueta</label>
            <input value={formElemento.etiqueta} onChange={(e) => setFormElemento((p) => ({ ...p, etiqueta: e.target.value }))} />
            <label>Color</label>
            <input type="color" value={formElemento.color} onChange={(e) => setFormElemento((p) => ({ ...p, color: e.target.value }))} />
            <label>Z inicio</label>
            <input type="number" value={formElemento.p1z} onChange={(e) => setFormElemento((p) => ({ ...p, p1z: Number(e.target.value) }))} />
            <label>Z fin</label>
            <input type="number" value={formElemento.p2z} onChange={(e) => setFormElemento((p) => ({ ...p, p2z: Number(e.target.value) }))} />
          </div>
        </section>

        <section className="panel">
          <h3>Nudo</h3>
          <div className="grid2">
            <label>Lado</label>
            <select value={formInter.lado} onChange={(e) => setFormInter((p) => ({ ...p, lado: e.target.value as Lado }))}>
              {lados.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <label>Desfase</label>
            <input type="number" step="0.01" value={formInter.desfase} onChange={(e) => setFormInter((p) => ({ ...p, desfase: Number(e.target.value) }))} />
            <label>Amarre</label>
            <input value={formInter.amarreTipo} onChange={(e) => setFormInter((p) => ({ ...p, amarreTipo: e.target.value }))} />
            <label>Paso</label>
            <input type="number" value={formInter.paso} onChange={(e) => setFormInter((p) => ({ ...p, paso: Number(e.target.value) }))} />
          </div>
        </section>

        <section className="panel">
          <h3>Paso a paso</h3>
          {pasos.slice().sort((a, b) => a.numero - b.numero).map((p) => (
            <div key={p.numero} className="pasoCard">
              <strong>Paso {p.numero}</strong>
              <label>Comentario</label>
              <textarea value={p.comentario} onChange={(e) => updatePaso(p.numero, { comentario: e.target.value })} />
              <div className="grid2 compact">
                <label>Rot X (de cabeza)</label>
                <input type="number" value={p.rotX} onChange={(e) => updatePaso(p.numero, { rotX: Number(e.target.value) })} />
                <label>Rot Z (vertical)</label>
                <input type="number" value={p.rotZ} onChange={(e) => updatePaso(p.numero, { rotZ: Number(e.target.value) })} />
              </div>
            </div>
          ))}
        </section>

        <section className="panel">
          <h3>JSON</h3>
          <div className="actions">
            <button onClick={exportarJson}>Exportar</button>
            <button onClick={importarJson}>Importar</button>
          </div>
          <textarea className="jsonBox" value={jsonTexto} onChange={(e) => setJsonTexto(e.target.value)} placeholder="Pega aquí el JSON para importar..." />
        </section>
      </aside>

      <main className="viewer">
        <div className="toolbar">
          <label>Paso en vista: {pasoVista}</label>
          <input type="range" min={1} max={Math.max(1, ...pasos.map((p) => p.numero))} value={pasoVista} onChange={(e) => setPasoVista(Number(e.target.value))} />
          <span className="rotationTag">↻ Rotar acumulado X:{rotacionAcumulada.x}° Z:{rotacionAcumulada.z}°</span>
        </div>

        <svg viewBox={`0 0 ${previewData.width} ${previewData.height}`} className="canvas" onClick={clickCanvas}>
          <rect x={0} y={0} width={previewData.width} height={previewData.height} fill="#f5f5f5" />

          <g className="floor-grid">
            {previewData.gridLines.map((g, i) => (
              <line key={`g-${i}`} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} />
            ))}
          </g>

          {previewData.lineas.map((l) => (
            <line
              key={`line-${l.id}`}
              x1={l.p1s.x}
              y1={l.p1s.y}
              x2={l.p2s.x}
              y2={l.p2s.y}
              stroke={seleccionNudo.includes(l.id) ? '#2962ff' : l.colorRender}
              strokeWidth={l.tipo === 'soga' ? 2 : l.tipo === 'cana' ? 4 : 3}
              strokeDasharray={l.tipo === 'soga' ? '6 4' : undefined}
              strokeLinecap="round"
              onClick={(e) => {
                e.stopPropagation()
                clickLinea(l.id)
              }}
            />
          ))}

          {previewData.nudos.map((n) => (
            <circle key={`n-${n.id}`} cx={n.ps.x} cy={n.ps.y} r={5} fill={n.color} />
          ))}
        </svg>

        <div className="legend">
          <span><i className="dot orange" />Paso actual</span>
          <span><i className="dot gray" />Construido previo</span>
          <span><i className="dot brown" />Nudo</span>
          <span><i className="dot blue" />Selección de pincel</span>
        </div>
      </main>
    </div>
  )
}
