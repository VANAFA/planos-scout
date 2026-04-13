import { MouseEvent, WheelEvent, useEffect, useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import './App.css'

type Vec3 = { x: number; y: number; z: number }
type SegmentType = 'palo' | 'soga' | 'cana' | 'tabla'
type ToolMode = 'select' | 'eraser'
type EndpointKey = 'both' | 'p1' | 'p2'
type InsertAssetKey = 'palo_largo' | 'palo_corto' | 'cana' | 'soga' | 'amarre'
type PresetAssetKey = 'tripode' | 'cuapode' | 'escalera' | 'marco' | 'amarre'
type PresetInsertKey = 'preset_tripode' | 'preset_cuapode' | 'preset_escalera' | 'preset_marco' | 'preset_amarre'
type PlaceableAssetKey = InsertAssetKey | PresetInsertKey

interface GhostPreview {
  asset: PlaceableAssetKey
  screen: { x: number; y: number }
  valid: boolean
  worldCenter?: Vec3
  anchorPoint?: Vec3
}

interface BoxSelectRect {
  x1: number
  y1: number
  x2: number
  y2: number
}

interface LashingPromptState {
  segmentId: number
  value: string
  screenX: number
  screenY: number
}

interface CameraBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

interface Segment {
  id: number
  type: SegmentType
  p1: Vec3
  p2: Vec3
  color: string
  step: number
}

interface StepMeta {
  step: number
  comentario?: string
  rotX?: number
  rotZ?: number
  amarres: string[]
  constructoresMin?: number
  constructoresMax?: number
}

interface ParseResult {
  segments: Segment[]
  warnings: string[]
  maxStep: number
  stepMeta: Record<number, StepMeta>
}

const BASE_VIEW_ROT_X = 45
const BASE_VIEW_ROT_Z = 45
const DEFAULT_VIEWPORT_WIDTH = 840
const DEFAULT_VIEWPORT_HEIGHT = 560

const FIXED_ASSET_LENGTH: Record<InsertAssetKey, number> = {
  palo_largo: 4,
  palo_corto: 2,
  cana: 2.4,
  soga: 1.8,
  amarre: 0.35,
}

const MAX_BUILD_DISTANCE_METERS = 10

const PRESET_INSERT_MAP: Record<PresetInsertKey, PresetAssetKey> = {
  preset_tripode: 'tripode',
  preset_cuapode: 'cuapode',
  preset_escalera: 'escalera',
  preset_marco: 'marco',
  preset_amarre: 'amarre',
}

const PRESET_GHOST_LABEL: Record<PresetInsertKey, string> = {
  preset_tripode: 'tripode',
  preset_cuapode: 'cuapode',
  preset_escalera: 'escalera',
  preset_marco: 'marco',
  preset_amarre: 'amarre',
}

const starterCode = `from engine import Engine3D

def main():
  engine = Engine3D()
  engine.set_modo_rapido(True)

  # Definicion de colores constantes
  COL_PALO = (139, 69, 19)
  COL_SOGA = (210, 180, 140)
  COL_TABLA = (160, 82, 45)

  # Coordenadas calculadas para simetria triangular (Radio 3.5)
  # P1: (0, 3.5), P2: (-3.03, -1.75), P3: (3.03, -1.75)

  # PASO: 1
  # Tripode de base con palos que sobrepasan el cruce
  engine.registrar_comentario_paso(1, "Levantar el tripode base. Los palos deben cruzarse a los 6m pero continuar hasta los 8m.")
  engine.registrar_rotacion_paso(1, 45, eje="z")
  engine.registrar_rotacion_paso(1, 10, eje="x")
  # Construccion manual para permitir que las puntas sobrepasen el amarre
  engine.palo((0, 3.5, 0), (0, -1, 8), COL_PALO, etiqueta="pata_base_1")
  engine.palo((-3.03, -1.75, 0), (1, 0.5, 8), COL_PALO, etiqueta="pata_base_2")
  engine.palo((3.03, -1.75, 0), (-1, 0.5, 8), COL_PALO, etiqueta="pata_base_3")
  # PASO_META: paso=1 amarre=Tripode constructores_min=3 constructores_max=6

  # PASO: 2
  # Refuerzos del suelo (Perimetro de base) - Ahora pegados al suelo (z=0) y conectados
  engine.registrar_comentario_paso(2, "Colocar los troncos de base a ras de suelo, conectando exactamente las patas del tripode.")
  engine.registrar_rotacion_paso(2, 45, eje="z")
  engine.palo((0, 3.5, 0), (-3.03, -1.75, 0), COL_PALO, etiqueta="suelo_1")
  engine.palo((-3.03, -1.75, 0), (3.03, -1.75, 0), COL_PALO, etiqueta="suelo_2")
  engine.palo((3.03, -1.75, 0), (0, 3.5, 0), COL_PALO, etiqueta="suelo_3")
  # PASO_META: paso=2 amarre=Cuadrado constructores_min=2 constructores_max=3

  # PASO: 3
  # Tripode superior invertido (Encastre en X)
  engine.registrar_comentario_paso(3, "Encastrar el segundo tripode. Sus patas nacen en z=4 y suben hasta z=12, cruzandose con el anterior.")
  engine.registrar_rotacion_paso(3, 45, eje="z")
  # Las patas superiores se abren hacia arriba
  engine.palo((0, -0.8, 4), (0, 4, 12), COL_PALO, etiqueta="pata_sup_1")
  engine.palo((0.7, 0.4, 4), (-3.46, -2, 12), COL_PALO, etiqueta="pata_sup_2")
  engine.palo((-0.7, 0.4, 4), (3.46, -2, 12), COL_PALO, etiqueta="pata_sup_3")
  # PASO_META: paso=3 amarre=Tripode constructores_min=3 constructores_max=6

  # PASO: 4
  # Amarre especial de union (Cruce de tripodes)
  engine.registrar_comentario_paso(4, "Realizar el amarre de union en la zona de interseccion de ambos tripodes (z=6 a z=7).")
  engine.registrar_rotacion_paso(4, 45, eje="z")
  engine.soga((-0.5, 0, 6.5), (0.5, 0, 6.5), COL_SOGA, etiqueta="amarre_central_1")
  engine.soga((0, -0.5, 6.5), (0, 0.5, 6.5), COL_SOGA, etiqueta="amarre_central_2")
  # PASO_META: paso=4 amarre=Especial_Encastre constructores_min=2 constructores_max=4

  # PASO: 5
  # Marco para la plataforma elevada
  engine.registrar_comentario_paso(5, "Instalar el marco horizontal triangular dentro del tripode superior.")
  engine.registrar_rotacion_paso(5, 45, eje="z")
  # Marco a altura z=10.5
  engine.palo((0, 3.2, 10.5), (-2.7, -1.6, 10.5), COL_PALO, etiqueta="marco_plataforma_1")
  engine.palo((-2.7, -1.6, 10.5), (2.7, -1.6, 10.5), COL_PALO, etiqueta="marco_plataforma_2")
  engine.palo((2.7, -1.6, 10.5), (0, 3.2, 10.5), COL_PALO, etiqueta="marco_plataforma_3")
  # PASO_META: paso=5 amarre=Cuadrado constructores_min=2 constructores_max=3

  # PASO: 6
  # Piso de la plataforma (Tablas corregidas)
  engine.registrar_comentario_paso(6, "Cubrir el marco con tablas para formar el piso de observacion.")
  engine.registrar_rotacion_paso(6, 45, eje="z")
  for i in range(9):
    y_fix = -1.4 + (i * 0.5)
    engine.tabla((-2.2, y_fix, 10.6), (2.2, 0, 0), COL_TABLA, largo=4.4, ancho=0.1, etiqueta=f"piso_{i}")
  # PASO_META: paso=6 amarre=Ballestrinque constructores_min=2 constructores_max=2

  # PASO: 7
  # Baranda superior y Escalera
  engine.registrar_comentario_paso(7, "Colocar la baranda perimetral y la escalera de acceso lateral.")
  engine.registrar_rotacion_paso(7, 45, eje="z")
  # Baranda en las puntas (z=12)
  engine.palo((0, 4, 12), (-3.46, -2, 12), COL_PALO, etiqueta="baranda_1")
  engine.palo((-3.46, -2, 12), (3.46, -2, 12), COL_PALO, etiqueta="baranda_2")
  engine.palo((3.46, -2, 12), (0, 4, 12), COL_PALO, etiqueta="baranda_3")
  # Escalera
  engine.palo((-4, 0, 0), (-2.5, 0, 10.5), COL_PALO, etiqueta="escalera_izq")
  engine.palo((-4, 1, 0), (-2.5, 1, 10.5), COL_PALO, etiqueta="escalera_der")
  for h in range(1, 11):
    step_z = h * 1.0
    step_x = -4 + (1.5 * h / 11)
    engine.palo((step_x, 0, step_z), (step_x, 1, step_z), COL_PALO, etiqueta=f"escalon_{h}")
  # PASO_META: paso=7 amarre=Transversal constructores_min=2 constructores_max=2

  # PASO: 8
  # Mastil final y decoracion
  engine.registrar_comentario_paso(8, "Rematar la construccion con el mastil para el farol de senales.")
  engine.registrar_rotacion_paso(8, 45, eje="z")
  engine.palo((0, 4, 12), (0, 4, 15), COL_PALO, etiqueta="mastil_final")
  engine.soga((0, 4, 15), (0.5, 4, 14.2), COL_SOGA, etiqueta="cuerda_farol")
  # PASO_META: paso=8 amarre=Ballestrinque constructores_min=1 constructores_max=1

  engine.show(mostrar_intersecciones=True)

if __name__ == "__main__":
  main()
`

const geminiPrompt = `Eres un generador de código Python para reconstrucción Scout 3D a partir de imagen(es) 2D, descripción textual, o combinaciones.

NOTA SOBRE IMÁGENES MÚLTIPLES Y ÁNGULOS:
- Una misma imagen puede contener múltiples ángulos de la MISMA estructura (vista frontal, lateral, superior, etc.).
- Pueden incluirse VARIAS FOTOS DIFERENTES de la misma construcción tomadas desde diferentes ángulos.
- Puede haber fotos parciales que muestren solo partes específicas de la construcción.
- Integra TODA la información visual para reconstruir el modelo 3D completo.
- Si hay ambigüedad entre vistas, prioriza la consistencia estructural y estabilidad.

OBJETIVO:
- Analizar imagen(es), descripción textual o ambas, e integrar toda la información visual/textual disponible.
- Convertir a una construcción en espacio 3D (x, y, z) estable y construible.
- Entregar SOLO código Python válido para este motor.

DISTINCIÓN OBLIGATORIA (MUY IMPORTANTE):
- engine.soga(...) = cuerda estructural física visible en la construcción (baranda, tirante, anclaje, etc).
- amarre (en registrar_amarre_paso o PASO_META) = técnica de atado para unir piezas (Cuadrado, Ballestrinque, Diagonal, etc).
- NUNCA uses "soga" como sustituto de "amarre".
- Siempre informar amarre por paso aunque no haya llamada nueva a engine.soga.

FORMATO OBLIGATORIO DEL SCRIPT:
1) Inicio fijo:
from engine import Engine3D

def main():
    engine = Engine3D()
    engine.set_modo_rapido(True)

2) Elementos permitidos (no inventar APIs):
IMPORTANTE: Usar ARGUMENTOS POSICIONALES para tripode y cuapode, SIN palabras clave.

Formatos CORRECTOS:
- engine.palo((x1, y1, z1), (x2, y2, z2), COLOR, etiqueta="...")
- engine.soga((x1, y1, z1), (x2, y2, z2), COLOR, etiqueta="...")
- engine.cana((x1, y1, z1), (x2, y2, z2), COLOR, etiqueta="...")
- engine.tabla((x, y, z), (dx, dy, dz), COLOR, largo=..., ancho=..., etiqueta="...")
- engine.tripode((cx, cy, z_base), altura, radio_base, COLOR, angulo_inicial=GRADOS)
- engine.cuapode((cx, cy, z_base), altura, radio_base, COLOR, angulo_inicial=GRADOS)
- engine.registrar_amarre_paso(paso, "TIPO", constructores_min=..., constructores_max=...)

EJEMPLOS EXACTOS DE tripode/cuapode:
- ✓ Correcto: engine.tripode((0, 0, 0), 3, 2, (139, 69, 19))
- ✓ Correcto con ángulo: engine.tripode((0, 0, 0), 3, 2, (139, 69, 19), angulo_inicial=45)
- ✓ Correcto: engine.cuapode((100, 100, 0), 6, 2.5, (200, 100, 50), angulo_inicial=0)

EL ORDEN DE ARGUMENTOS PARA tripode/cuapode ES:
1) Centro (x, y, z_base) - TUPLA
2) Altura - NÚMERO
3) Radio base - NÚMERO  
4) Color - TUPLA RGB o NOMBRE DE VARIABLE
5) etiqueta_prefix - OPCIONAL, solo si necesitas etiquetar especialmente

REGLAS DE tabla:
- Si no se especifica largo, usar por defecto el tamaño de palo corto.
- Si no se especifica ancho, usar por defecto ancho = largo / 5.

3) Colores:
- RGB literal (r,g,b) o constantes como:
  COL_PALO = (139, 69, 19)
  COL_SOGA = (210, 180, 140)

4) Pasos de construcción (obligatorio):
- Antes de cada bloque:
  # PASO: N
- Cada elemento debe pertenecer a un paso lógico de montaje real.
- Incluir pasos de "solo rotación" cuando ayuden a ver el montaje.

5) Metadatos obligatorios por cada paso N:
- engine.registrar_comentario_paso(N, "instrucción breve y accionable")
- Registrar amarre del paso (preferido):
  engine.registrar_amarre_paso(N, "TIPO", constructores_min=A, constructores_max=B)
- Rotación de vista (ángulo exacto por paso, NO incremental):
  engine.registrar_rotacion_paso(N, angulo, eje="x")
  engine.registrar_rotacion_paso(N, angulo, eje="z")
- Elegir un único ángulo base para toda la construcción y mantenerlo.
- Cambiar la rotación solo cuando sea necesario para mostrar mejor el siguiente montaje.
- Alternativa compatible si no se usa registrar_amarre_paso:
  # PASO_META: paso=N amarre=TIPO constructores_min=A constructores_max=B

6) Cierre fijo:
    engine.show(mostrar_intersecciones=True)

if __name__ == "__main__":
    main()

CRITERIOS DE INTERPRETACIÓN (IMAGEN O DESCRIPCIÓN) -> 3D:
- z es altura vertical.
- Inferir profundidad (eje y) y alturas (eje z) de forma consistente con la perspectiva visual o con los detalles del texto.
- Mantener simetría cuando la imagen o la descripción sugieran simetría.
- Priorizar estabilidad estructural y secuencia de montaje segura.
- Si hay ambigüedad, elegir la opción más simple y construible.

USO DE ESTRUCTURAS PREDEFINIDAS (OBLIGATORIO CUANDO APLIQUE):
- Si la imagen o la descripción indican claramente un trípode, usar:
  engine.tripode((cx, cy, z_base), altura, radio_base, COLOR, angulo_inicial=GRADOS)
  Ejemplo: engine.tripode((0, 0, 0), 8, 3, COL_PALO, angulo_inicial=0)
  Ejemplo con rotación: engine.tripode((-100, 50, 0), 10, 4, COL_PALO, angulo_inicial=45)
  
- Si la imagen o la descripción indican claramente un cuápode/cuadrípode, usar:
  engine.cuapode((cx, cy, z_base), altura, radio_base, COLOR, angulo_inicial=GRADOS)
  Ejemplo: engine.cuapode((100, 100, 0), 6, 2.5, (200, 100, 50), angulo_inicial=0)
  Ejemplo con rotación: engine.cuapode((0, 0, 0), 5, 2, COL_PALO, angulo_inicial=90)

PARÁMETRO angulo_inicial EXPLICADO:
- Valor en GRADOS: representa la dirección donde apunta la PRIMERA PATA
- 0° = Pata 1 apunta hacia eje X positivo (derecha)
- 90° = Pata 1 apunta hacia eje Y positivo (arriba)
- 180° = Pata 1 apunta hacia eje X negativo (izquierda)
- 270° = Pata 1 apunta hacia eje Y negativo (abajo)
- Rango: 0 a 360 grados

VISUALIZACIÓN DESDE ARRIBA (vista Z negativa):
tripode con angulo_inicial=0°:        tripode con angulo_inicial=90°:
         pata1         |                      pata1
            |\         |                         |
            | \        |                         |\
  pata3---------pata2  |              pata3------*------pata2

DISTRIBUCIÓN DE PATAS:
- tripode: 3 patas distribuidas a 120° entre sí
  - angulo_inicial=0°: patas en 0°, 120°, 240°
  - angulo_inicial=30°: patas en 30°, 150°, 270°
  
- cuapode: 4 patas distribuidas a 90° entre sí
  - angulo_inicial=0°: patas en 45°, 135°, 225°, 315°
  - angulo_inicial=45°: patas en 90°, 180°, 270°, 0° (cuadrado alineado con ejes)

EJEMPLOS DE USO:
- Tripode: engine.tripode((0, 0, 0), 8, 3, COL_PALO, angulo_inicial=0) -> pata principal apunta este
- Tripode: engine.tripode((0, 0, 0), 8, 3, COL_PALO, angulo_inicial=30) -> pata principal rotada 30° (noreste)
- Cuapode: engine.cuapode((100, 100, 0), 6, 2.5, COL_PALO, angulo_inicial=0) -> patas en diagonal
- Cuapode: engine.cuapode((100, 100, 0), 6, 2.5, COL_PALO, angulo_inicial=45) -> patas alineadas con ejes X/Y

REGLA: Siempre usa angulo_inicial con el valor que alinee las patas según la fotografía o descripción.

- Regla anti-confusión: cuápode/cuadrípode/4 patas/mesa-banco con cuatro apoyos SIEMPRE = engine.cuapode(...), NUNCA engine.tripode(...).
- engine.tripode(...) solo se permite cuando se observan exactamente 3 patas/apoyos.
- Si NO se identifica una de estas estructuras, construir con palo/soga/cana normales.

RESTRICCIÓN CRÍTICA PARA tripode/cuapode:
- NUNCA usar argumentos nombrados (kwargs) EXCEPTO angulo_inicial

REQUISITO VISUAL DEL ÚLTIMO PASO:
- En el último paso, mostrar el plano completo a todo color (sin convertir piezas previas a gris).

FORMATO DE SALIDA OBLIGATORIO:
- Responder en un ÚNICO bloque Markdown de código python y nada más.
- Formato exacto:
\`\`\`python
[script completo]
\`\`\`
`

function rotatePoint3D(p: Vec3, center: Vec3, rotXDeg: number, rotZDeg: number): Vec3 {
  const rx = (rotXDeg * Math.PI) / 180
  const rz = (rotZDeg * Math.PI) / 180

  const px = p.x - center.x
  const py = p.y - center.y
  const pz = p.z - center.z

  const xz = px * Math.cos(rz) - py * Math.sin(rz)
  const yz = px * Math.sin(rz) + py * Math.cos(rz)
  const zz = pz

  const xx = xz
  const yx = yz * Math.cos(rx) - zz * Math.sin(rx)
  const zx = yz * Math.sin(rx) + zz * Math.cos(rx)

  return { x: xx + center.x, y: yx + center.y, z: zx + center.z }
}

function projectPoint(p: Vec3): { x: number; y: number } {
  return { x: p.x, y: -p.z + p.y * 0.2 }
}

function evaluateNumericExpression(expr: string, env: Record<string, number>): number {
  if (!/^[0-9A-Za-z_+\-*/().\s]+$/.test(expr)) return Number.NaN
  try {
    const keys = Object.keys(env)
    const values = keys.map((k) => env[k])
    const result = new Function(...keys, `return (${expr});`)(...values)
    return Number(result)
  } catch {
    return Number.NaN
  }
}

function expandSimpleForLoops(code: string): string {
  const forBlockRegex = /(^|\n)([ \t]*)for\s+(\w+)\s+in\s+range\(([^)]*)\):\s*\n((?:\2[ \t]+.*\n?)*)/gm

  return code.replace(forBlockRegex, (_full, leadingBreak, indent, varName, rangeArgsRaw, bodyRaw) => {
    const args = rangeArgsRaw
      .split(',')
      .map((v: string) => v.trim())
      .filter((v: string) => v.length > 0)
      .map((v: string) => Number(v))

    let start = 0
    let end = 0
    let step = 1
    if (args.length === 1) {
      end = args[0]
    } else if (args.length === 2) {
      start = args[0]
      end = args[1]
    } else if (args.length >= 3) {
      start = args[0]
      end = args[1]
      step = args[2]
    }

    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step) || step === 0) {
      return `${leadingBreak}${indent}# FOR_NO_EXPAND: for ${varName} in range(${rangeArgsRaw})\n${bodyRaw}`
    }

    const bodyLines = bodyRaw.split('\n').filter((line: string) => line.trim().length > 0)
    let expanded = ''

    const shouldContinue = (i: number) => (step > 0 ? i < end : i > end)
    for (let i = start; shouldContinue(i); i += step) {
      const env: Record<string, number> = { [varName]: i }

      for (const originalLine of bodyLines) {
        const assignment = originalLine.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.+)$/)
        if (assignment) {
          const assignName = assignment[1]
          const assignExpr = assignment[2]
          const value = evaluateNumericExpression(assignExpr, env)
          if (Number.isFinite(value)) env[assignName] = value
          continue
        }

        let replacedLine = originalLine
        for (const [name, value] of Object.entries(env)) {
          const wordRegex = new RegExp(`\\b${name}\\b`, 'g')
          replacedLine = replacedLine.replace(wordRegex, String(value))
        }
        expanded += `${replacedLine}\n`
      }
    }

    return `${leadingBreak}${expanded}`
  })
}

function parseVec3(tupleText: string, env: Record<string, number>): Vec3 | null {
  const parts = tupleText.split(',').map((v) => v.trim())
  if (parts.length !== 3) return null
  const x = evaluateNumericExpression(parts[0], env)
  const y = evaluateNumericExpression(parts[1], env)
  const z = evaluateNumericExpression(parts[2], env)
  if (![x, y, z].every(Number.isFinite)) return null
  return { x, y, z }
}

function parseColorToken(
  colorToken: string,
  colorConstants: Map<string, [number, number, number]>,
): [number, number, number] | null {
  if (colorToken.startsWith('(') && colorToken.endsWith(')')) {
    const colorParts = colorToken
      .slice(1, -1)
      .split(',')
      .map((v) => Number(v.trim()))
    if (colorParts.length !== 3 || colorParts.some((n) => Number.isNaN(n))) return null
    return [
      Math.max(0, Math.min(255, Math.round(colorParts[0]))),
      Math.max(0, Math.min(255, Math.round(colorParts[1]))),
      Math.max(0, Math.min(255, Math.round(colorParts[2]))),
    ]
  }

  if (colorConstants.has(colorToken)) {
    const [r, g, b] = colorConstants.get(colorToken) as [number, number, number]
    return [
      Math.max(0, Math.min(255, Math.round(r))),
      Math.max(0, Math.min(255, Math.round(g))),
      Math.max(0, Math.min(255, Math.round(b))),
    ]
  }

  return null
}

function parseConstruction(code: string): ParseResult {
  const expandedCode = expandSimpleForLoops(code)
  const warnings: string[] = []
  const segments: Segment[] = []
  const stepMeta: Record<number, StepMeta> = {}

  const ensureStepMeta = (step: number) => {
    if (!stepMeta[step]) {
      stepMeta[step] = { step, amarres: [] }
    }
    return stepMeta[step]
  }

  const colorConstants = new Map<string, [number, number, number]>()
  const constRegex =
    /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/gm
  let constMatch: RegExpExecArray | null
  while ((constMatch = constRegex.exec(expandedCode)) !== null) {
    colorConstants.set(constMatch[1], [Number(constMatch[2]), Number(constMatch[3]), Number(constMatch[4])])
  }

  const numericConstants = new Map<string, number>()
  const numberConstRegex = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(-?\d+(?:\.\d+)?)\s*$/gm
  let nMatch: RegExpExecArray | null
  while ((nMatch = numberConstRegex.exec(expandedCode)) !== null) {
    numericConstants.set(nMatch[1], Number(nMatch[2]))
  }

  const commentRegex = /engine\.registrar_comentario_paso\(\s*(\d+)\s*,\s*["']([^"']+)["']/g
  let cMatch: RegExpExecArray | null
  while ((cMatch = commentRegex.exec(expandedCode)) !== null) {
    const step = Number(cMatch[1])
    ensureStepMeta(step).comentario = cMatch[2]
  }

  const rotationRegex = /engine\.registrar_rotacion_paso\(\s*(\d+)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*eje\s*=\s*["']([xz])["']/g
  let rMatch: RegExpExecArray | null
  while ((rMatch = rotationRegex.exec(expandedCode)) !== null) {
    const step = Number(rMatch[1])
    const angle = Number(rMatch[2])
    const axis = rMatch[3]
    if (axis === 'x') ensureStepMeta(step).rotX = angle
    if (axis === 'z') ensureStepMeta(step).rotZ = angle
  }

  const stepMetaLineRegex = /#\s*PASO_META\s*:\s*paso\s*=\s*(\d+)([^\n]*)/gim
  let mMatch: RegExpExecArray | null
  while ((mMatch = stepMetaLineRegex.exec(expandedCode)) !== null) {
    const step = Number(mMatch[1])
    const rest = mMatch[2]
    const meta = ensureStepMeta(step)

    const amarre = rest.match(/amarre\s*=\s*([A-Za-zÁÉÍÓÚáéíóú0-9_\-]+)/i)
    const cMin = rest.match(/constructores_min\s*=\s*(\d+)/i)
    const cMax = rest.match(/constructores_max\s*=\s*(\d+)/i)
    if (amarre && !meta.amarres.includes(amarre[1])) meta.amarres.push(amarre[1])
    if (cMin) meta.constructoresMin = Number(cMin[1])
    if (cMax) meta.constructoresMax = Number(cMax[1])
  }

  const amarreMethodRegex =
    /engine\.registrar_amarre_paso\(\s*(\d+)\s*,\s*["']([^"']+)["']\s*(?:,\s*([^\)]*))?\)/g
  let aMatch: RegExpExecArray | null
  while ((aMatch = amarreMethodRegex.exec(expandedCode)) !== null) {
    const step = Number(aMatch[1])
    const amarreTipo = aMatch[2].trim()
    const rest = aMatch[3] || ''
    const meta = ensureStepMeta(step)

    if (amarreTipo && !meta.amarres.includes(amarreTipo)) {
      meta.amarres.push(amarreTipo)
    }

    const cMin = rest.match(/constructores_min\s*=\s*(\d+)/i)
    const cMax = rest.match(/constructores_max\s*=\s*(\d+)/i)
    if (cMin) meta.constructoresMin = Number(cMin[1])
    if (cMax) meta.constructoresMax = Number(cMax[1])
  }

  const lines = expandedCode.split(/\r?\n/)
  let currentStep = 1
  let id = 1
  const env: Record<string, number> = Object.fromEntries(numericConstants)

  const pushSegment = (type: SegmentType, p1: Vec3, p2: Vec3, rgb: [number, number, number], step: number) => {
    segments.push({
      id,
      type,
      p1,
      p2,
      color: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
      step,
    })
    ensureStepMeta(step)
    id += 1
  }

  const segmentLineRegex =
    /engine\.(palo|soga|cana)\s*\(\s*\(([^)]+)\)\s*,\s*\(([^)]+)\)\s*,\s*(\([^)]*\)|[A-Za-z_][A-Za-z0-9_]*)/
  const tablaLineRegex =
    /engine\.tabla\s*\(\s*\(([^)]+)\)\s*,\s*\(([^)]+)\)\s*,\s*(\([^)]*\)|[A-Za-z_][A-Za-z0-9_]*)([^\n]*)/
  const soporteLineRegex =
    /engine\.(tripode|cuapode)\s*\(\s*\(([^)]+)\)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*(\([^)]*\)|[A-Za-z_][A-Za-z0-9_]*)([^)]*)\)/

  for (const line of lines) {
    const stepHeader = line.match(/#\s*PASO\s*[:=]\s*(\d+)/i)
    if (stepHeader) {
      currentStep = Number(stepHeader[1])
      ensureStepMeta(currentStep)
      continue
    }

    const stepInline = line.match(/paso\s*[:=]\s*(\d+)/i) || line.match(/paso\s*=\s*(\d+)/i)
    const step = stepInline ? Number(stepInline[1]) : currentStep

    const segmentMatch = line.match(segmentLineRegex)
    if (segmentMatch) {
      const type = segmentMatch[1] as SegmentType
      const p1 = parseVec3(segmentMatch[2], env)
      const p2 = parseVec3(segmentMatch[3], env)
      const color = parseColorToken(segmentMatch[4].trim(), colorConstants)

      if (!p1 || !p2 || !color) {
        warnings.push(`Línea inválida para elemento: ${line.trim()}`)
        continue
      }

      pushSegment(type, p1, p2, color, step)
      continue
    }

    const tablaMatch = line.match(tablaLineRegex)
    if (tablaMatch) {
      const inicio = parseVec3(tablaMatch[1], env)
      const direccion = parseVec3(tablaMatch[2], env)
      const color = parseColorToken(tablaMatch[3].trim(), colorConstants)
      const extraArgs = tablaMatch[4] || ''
      const largoMatch = extraArgs.match(/largo\s*=\s*([^,\)\n]+)/i)

      const largo = largoMatch ? evaluateNumericExpression(largoMatch[1].trim(), env) : 1.5

      if (!inicio || !direccion || !color || !Number.isFinite(largo) || largo <= 0) {
        warnings.push(`Línea inválida para elemento: ${line.trim()}`)
        continue
      }

      const norma = Math.hypot(direccion.x, direccion.y, direccion.z)
      if (norma === 0) {
        warnings.push(`Línea inválida para elemento: ${line.trim()}`)
        continue
      }

      const fin: Vec3 = {
        x: inicio.x + (direccion.x / norma) * largo,
        y: inicio.y + (direccion.y / norma) * largo,
        z: inicio.z + (direccion.z / norma) * largo,
      }

      pushSegment('tabla', inicio, fin, color, step)
      continue
    }

    const soporteMatch = line.match(soporteLineRegex)
    if (soporteMatch) {
      const soporteTipo = soporteMatch[1]
      const centro = parseVec3(soporteMatch[2], env)
      const altura = evaluateNumericExpression(soporteMatch[3].trim(), env)
      const radioBase = evaluateNumericExpression(soporteMatch[4].trim(), env)
      const color = parseColorToken(soporteMatch[5].trim(), colorConstants)
      
      // Extraer angulo_inicial si existe
      const extraArgs = soporteMatch[6] || ''
      const anguloMatch = extraArgs.match(/angulo_inicial\s*=\s*([^,\)\n]+)/i)
      const anguloInicial = anguloMatch 
        ? (evaluateNumericExpression(anguloMatch[1].trim(), env) * Math.PI) / 180 
        : 0

      if (!centro || !Number.isFinite(altura) || !Number.isFinite(radioBase) || !color) {
        warnings.push(`Línea inválida para elemento: ${line.trim()}`)
        continue
      }

      const apex: Vec3 = { x: centro.x, y: centro.y, z: centro.z + altura }

      if (soporteTipo === 'tripode') {
        // Tres patas distribuidas a 120 grados, rotadas por angulo_inicial
        const angulos = [
          anguloInicial,
          anguloInicial + (2 * Math.PI) / 3,
          anguloInicial + (4 * Math.PI) / 3
        ]
        for (const ang of angulos) {
          const base: Vec3 = {
            x: centro.x + radioBase * Math.cos(ang),
            y: centro.y + radioBase * Math.sin(ang),
            z: centro.z,
          }
          pushSegment('palo', apex, base, color, step)
        }
      } else {
        // Cuatro patas distribuidas a 45, 135, 225, 315 grados, rotadas por angulo_inicial
        const angulos = [
          anguloInicial + Math.PI / 4,
          anguloInicial + (3 * Math.PI) / 4,
          anguloInicial + (5 * Math.PI) / 4,
          anguloInicial + (7 * Math.PI) / 4,
        ]
        for (const ang of angulos) {
          const base: Vec3 = {
            x: centro.x + radioBase * Math.cos(ang),
            y: centro.y + radioBase * Math.sin(ang),
            z: centro.z,
          }
          pushSegment('palo', apex, base, color, step)
        }
      }
    }
  }

  // Empty scenes are valid while the user starts from scratch.

  const stepHasSoga = new Set<number>()
  for (const segment of segments) {
    if (segment.type === 'soga') stepHasSoga.add(segment.step)
  }
  for (const step of stepHasSoga) {
    const meta = stepMeta[step]
    if (!meta || meta.amarres.length === 0) {
      warnings.push(
        `Paso ${step}: hay engine.soga(...) pero no hay amarre registrado (usa engine.registrar_amarre_paso o # PASO_META).`,
      )
    }
  }

  const maxStep = Math.max(
    1,
    ...segments.map((s) => s.step),
    ...Object.keys(stepMeta).map((k) => Number(k)),
  )

  return { segments, warnings, maxStep, stepMeta }
}

function getCumulativeStepRotation(
  step: number,
  stepMeta: Record<number, StepMeta>,
  defaultRotX: number,
  defaultRotZ: number,
) {
  let rotX = defaultRotX
  let rotZ = defaultRotZ
  for (let i = 1; i <= step; i += 1) {
    const meta = stepMeta[i]
    if (!meta) continue
    if (typeof meta.rotX === 'number') rotX = meta.rotX
    if (typeof meta.rotZ === 'number') rotZ = meta.rotZ
  }
  return { rotX, rotZ }
}

function buildStepDrawing(
  segments: Segment[],
  stepMeta: Record<number, StepMeta>,
  step: number,
  width: number,
  height: number,
  viewRotX: number,
  viewRotZ: number,
  viewZoom: number,
  panX: number,
  panY: number,
  cameraBounds: CameraBounds | null,
) {
  const allPoints = segments.flatMap((s) => [s.p1, s.p2])
  const center = allPoints.length
    ? {
        x: allPoints.reduce((acc, p) => acc + p.x, 0) / allPoints.length,
        y: allPoints.reduce((acc, p) => acc + p.y, 0) / allPoints.length,
        z: allPoints.reduce((acc, p) => acc + p.z, 0) / allPoints.length,
      }
    : { x: 0, y: 0, z: 0 }

  const stepRotation = getCumulativeStepRotation(step, stepMeta, BASE_VIEW_ROT_X, BASE_VIEW_ROT_Z)
  const manualDeltaX = viewRotX - BASE_VIEW_ROT_X
  const manualDeltaZ = viewRotZ - BASE_VIEW_ROT_Z
  const rotX = stepRotation.rotX + manualDeltaX
  const rotZ = stepRotation.rotZ + manualDeltaZ

  const projectWorldPoint = (p: Vec3) => {
    const pr = rotatePoint3D(p, center, rotX, rotZ)
    return projectPoint(pr)
  }

  const projectedAll = segments.map((s) => {
    const p1r = rotatePoint3D(s.p1, center, rotX, rotZ)
    const p2r = rotatePoint3D(s.p2, center, rotX, rotZ)
    return {
      ...s,
      a: projectPoint(p1r),
      b: projectPoint(p2r),
    }
  })

  const all2DPoints = projectedAll.flatMap((s) => [s.a, s.b])
  const base2D = all2DPoints.length ? all2DPoints : [{ x: 0, y: 0 }]
  const minX = Math.min(...base2D.map((p) => p.x))
  const maxX = Math.max(...base2D.map((p) => p.x))
  const minY = Math.min(...base2D.map((p) => p.y))
  const maxY = Math.max(...base2D.map((p) => p.y))

  const candidateBounds: CameraBounds = { minX, maxX, minY, maxY }
  const usedBounds: CameraBounds = cameraBounds
    ? {
        minX: Math.min(cameraBounds.minX, candidateBounds.minX),
        maxX: Math.max(cameraBounds.maxX, candidateBounds.maxX),
        minY: Math.min(cameraBounds.minY, candidateBounds.minY),
        maxY: Math.max(cameraBounds.maxY, candidateBounds.maxY),
      }
    : candidateBounds

  const margin = 8
  const availableWidth = width - margin * 2
  const availableHeight = height - margin * 2
  const sx = availableWidth / Math.max(usedBounds.maxX - usedBounds.minX, 0.001)
  const sy = availableHeight / Math.max(usedBounds.maxY - usedBounds.minY, 0.001)
  const scale = Math.min(sx, sy) * viewZoom
  const contentWidth = Math.max(usedBounds.maxX - usedBounds.minX, 0.001) * scale
  const contentHeight = Math.max(usedBounds.maxY - usedBounds.minY, 0.001) * scale
  const offsetX = margin + (availableWidth - contentWidth) / 2 + panX
  const offsetY = margin + (availableHeight - contentHeight) / 2 + panY

  const map = (p: { x: number; y: number }) => ({
    x: offsetX + (p.x - usedBounds.minX) * scale,
    y: offsetY + (p.y - usedBounds.minY) * scale,
  })

  const unmap = (x: number, y: number) => ({
    x: usedBounds.minX + (x - offsetX) / scale,
    y: usedBounds.minY + (y - offsetY) / scale,
  })

  const projectWorldToScreen = (p: Vec3) => map(projectWorldPoint(p))

  const worldMinX = allPoints.length ? Math.min(...allPoints.map((p) => p.x)) : -6
  const worldMaxX = allPoints.length ? Math.max(...allPoints.map((p) => p.x)) : 6
  const worldMinY = allPoints.length ? Math.min(...allPoints.map((p) => p.y)) : -6
  const worldMaxY = allPoints.length ? Math.max(...allPoints.map((p) => p.y)) : 6
  const worldMinZ = allPoints.length ? Math.min(...allPoints.map((p) => p.z)) : 0
  const worldMaxZ = allPoints.length ? Math.max(...allPoints.map((p) => p.z)) : 8

  const gridStep = 0.5
  const floorGrid: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
  const wallGrid: Array<{ x1: number; y1: number; x2: number; y2: number }> = []

  const gxStart = Math.floor((worldMinX - 1) / gridStep) * gridStep
  const gxEnd = Math.ceil((worldMaxX + 1) / gridStep) * gridStep
  const gyStart = Math.floor((worldMinY - 1) / gridStep) * gridStep
  const gyEnd = Math.ceil((worldMaxY + 1) / gridStep) * gridStep
  const gzStart = Math.floor(Math.max(0, worldMinZ - 1) / gridStep) * gridStep
  const gzEnd = Math.ceil((worldMaxZ + 1) / gridStep) * gridStep

  for (let gx = gxStart; gx <= gxEnd; gx += gridStep) {
    const a = projectWorldToScreen({ x: gx, y: gyStart, z: 0 })
    const b = projectWorldToScreen({ x: gx, y: gyEnd, z: 0 })
    floorGrid.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
  }
  for (let gy = gyStart; gy <= gyEnd; gy += gridStep) {
    const a = projectWorldToScreen({ x: gxStart, y: gy, z: 0 })
    const b = projectWorldToScreen({ x: gxEnd, y: gy, z: 0 })
    floorGrid.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
  }

  for (let gx = gxStart; gx <= gxEnd; gx += gridStep) {
    const a = projectWorldToScreen({ x: gx, y: gyStart, z: gzStart })
    const b = projectWorldToScreen({ x: gx, y: gyStart, z: gzEnd })
    wallGrid.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
  }
  for (let gz = gzStart; gz <= gzEnd; gz += gridStep) {
    const a = projectWorldToScreen({ x: gxStart, y: gyStart, z: gz })
    const b = projectWorldToScreen({ x: gxEnd, y: gyStart, z: gz })
    wallGrid.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
  }

  const visibleLines = projectedAll
    .filter((s) => s.step <= step)
    .map((s) => ({
      ...s,
      as: map(s.a),
      bs: map(s.b),
      isPrevious: s.step < step,
    }))

  return {
    width,
    height,
    lines: visibleLines,
    rotX,
    rotZ,
    unmap,
    floorGrid,
    wallGrid,
    projectWorldToScreen,
    cameraBounds: usedBounds,
  }
}

function formatNumber(n: number): string {
  const rounded = Math.round(n * 100) / 100
  if (Number.isInteger(rounded)) return String(rounded)
  return String(rounded)
}

function vecToPy(v: Vec3): string {
  return `(${formatNumber(v.x)}, ${formatNumber(v.y)}, ${formatNumber(v.z)})`
}

function cloneStepMeta(stepMeta: Record<number, StepMeta>): Record<number, StepMeta> {
  const copy: Record<number, StepMeta> = {}
  for (const [k, value] of Object.entries(stepMeta)) {
    copy[Number(k)] = { ...value, amarres: [...value.amarres] }
  }
  return copy
}

function buildPythonFromModel(
  segments: Segment[],
  stepMeta: Record<number, StepMeta>,
  maxStep: number,
): string {
  const lines: string[] = [
    'from engine import Engine3D',
    '',
    'def main():',
    '  engine = Engine3D()',
    '  engine.set_modo_rapido(True)',
    '',
  ]

  for (let step = 1; step <= Math.max(1, maxStep); step += 1) {
    const meta = stepMeta[step] ?? { step, amarres: [] }
    const stepSegments = segments.filter((s) => s.step === step)

    lines.push(`  # PASO: ${step}`)
    lines.push(
      `  engine.registrar_comentario_paso(${step}, ${JSON.stringify(
        meta.comentario || `Montaje del paso ${step}`,
      )})`,
    )
    if (typeof meta.rotZ === 'number') {
      lines.push(`  engine.registrar_rotacion_paso(${step}, ${formatNumber(meta.rotZ)}, eje="z")`)
    }
    if (typeof meta.rotX === 'number') {
      lines.push(`  engine.registrar_rotacion_paso(${step}, ${formatNumber(meta.rotX)}, eje="x")`)
    }
    if (meta.amarres.length) {
      const cMin = typeof meta.constructoresMin === 'number' ? meta.constructoresMin : 1
      const cMax = typeof meta.constructoresMax === 'number' ? meta.constructoresMax : cMin
      lines.push(
        `  engine.registrar_amarre_paso(${step}, ${JSON.stringify(meta.amarres[0])}, constructores_min=${cMin}, constructores_max=${cMax})`,
      )
    }

    for (const segment of stepSegments) {
      const [r, g, b] = extractRgb(segment.color)
      const color = `(${r}, ${g}, ${b})`
      if (segment.type === 'tabla') {
        const dir = {
          x: segment.p2.x - segment.p1.x,
          y: segment.p2.y - segment.p1.y,
          z: segment.p2.z - segment.p1.z,
        }
        const largo = Math.hypot(dir.x, dir.y, dir.z)
        lines.push(
          `  engine.tabla(${vecToPy(segment.p1)}, ${vecToPy(dir)}, ${color}, largo=${formatNumber(largo)}, ancho=0.1, etiqueta="tabla_${segment.id}")`,
        )
      } else {
        lines.push(
          `  engine.${segment.type}(${vecToPy(segment.p1)}, ${vecToPy(segment.p2)}, ${color}, etiqueta="${segment.type}_${segment.id}")`,
        )
      }
    }
    lines.push('')
  }

  lines.push('  engine.show(mostrar_intersecciones=True)')
  lines.push('')
  lines.push('if __name__ == "__main__":')
  lines.push('  main()')

  return lines.join('\n')
}

function distanceToSegment2D(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const apx = p.x - a.x
  const apy = p.y - a.y
  const ab2 = abx * abx + aby * aby
  if (ab2 === 0) return Math.hypot(apx, apy)
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2))
  const cx = a.x + abx * t
  const cy = a.y + aby * t
  return Math.hypot(p.x - cx, p.y - cy)
}

function distancePointToSegment3D(p: Vec3, a: Vec3, b: Vec3): number {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }
  const ap = { x: p.x - a.x, y: p.y - a.y, z: p.z - a.z }
  const ab2 = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z
  if (ab2 <= 1e-9) return Math.hypot(ap.x, ap.y, ap.z)
  const t = Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y + ap.z * ab.z) / ab2))
  const c = { x: a.x + ab.x * t, y: a.y + ab.y * t, z: a.z + ab.z * t }
  return Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z)
}

function isPresetInsertAsset(asset: PlaceableAssetKey): asset is PresetInsertKey {
  return asset.startsWith('preset_')
}

function normalizeRad(angle: number) {
  let a = angle
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

function axisUnit(axis: 'x' | 'y' | 'z'): Vec3 {
  if (axis === 'x') return { x: 1, y: 0, z: 0 }
  if (axis === 'y') return { x: 0, y: 1, z: 0 }
  return { x: 0, y: 0, z: 1 }
}

function rotatePointAroundAxis(point: Vec3, pivot: Vec3, axis: 'x' | 'y' | 'z', angleDeg: number): Vec3 {
  const k = axisUnit(axis)
  const t = (angleDeg * Math.PI) / 180
  const c = Math.cos(t)
  const s = Math.sin(t)

  const v = {
    x: point.x - pivot.x,
    y: point.y - pivot.y,
    z: point.z - pivot.z,
  }

  const kv = k.x * v.x + k.y * v.y + k.z * v.z
  const kCrossV = {
    x: k.y * v.z - k.z * v.y,
    y: k.z * v.x - k.x * v.z,
    z: k.x * v.y - k.y * v.x,
  }

  return {
    x: pivot.x + v.x * c + kCrossV.x * s + k.x * kv * (1 - c),
    y: pivot.y + v.y * c + kCrossV.y * s + k.y * kv * (1 - c),
    z: pivot.z + v.z * c + kCrossV.z * s + k.z * kv * (1 - c),
  }
}

function App() {
  const [code, setCode] = useState(starterCode)
  const [instructionStep, setInstructionStep] = useState(1)
  const [viewRotX, setViewRotX] = useState(BASE_VIEW_ROT_X)
  const [viewRotZ, setViewRotZ] = useState(BASE_VIEW_ROT_Z)
  const [viewZoom, setViewZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [showCodePanel, setShowCodePanel] = useState(false)
  const [leftPanelTab, setLeftPanelTab] = useState<'assets' | 'steps'>('assets')
  const [activeInsertAsset, setActiveInsertAsset] = useState<PlaceableAssetKey | null>(null)
  const [rightDragStart, setRightDragStart] = useState<{ x: number; y: number } | null>(null)
  const [middleDragStart, setMiddleDragStart] = useState<{ x: number; y: number } | null>(null)
  const [boxSelectRect, setBoxSelectRect] = useState<BoxSelectRect | null>(null)
  const [ghostPreview, setGhostPreview] = useState<GhostPreview | null>(null)
  const [lashingNames, setLashingNames] = useState<Record<number, string>>({})
  const [lashingPrompt, setLashingPrompt] = useState<LashingPromptState | null>(null)
  const [tool, setTool] = useState<ToolMode>('select')
  const [selectedSegmentId, setSelectedSegmentId] = useState<number | null>(null)
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<number[]>([])
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointKey>('both')
  const [showStepManager, setShowStepManager] = useState(false)
  const [errorCopied, setErrorCopied] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showEasyMode, setShowEasyMode] = useState(false)
  const [easyPromptCopied, setEasyPromptCopied] = useState(false)
  const [viewportSize, setViewportSize] = useState({
    width: DEFAULT_VIEWPORT_WIDTH,
    height: DEFAULT_VIEWPORT_HEIGHT,
  })
  const [gizmoDrag, setGizmoDrag] = useState<{
    axis: 'x' | 'y' | 'z'
    ux: number
    uy: number
    startX: number
    startY: number
    pixelsPerUnit: number
    selectedIds: number[]
    basePoints: Record<number, { p1: Vec3; p2: Vec3 }>
  } | null>(null)
  const [rotationDrag, setRotationDrag] = useState<{
    axis: 'x' | 'y' | 'z'
    pivot: Vec3
    startAngleRad: number
    selectedIds: number[]
    baseSegments: Record<number, { p1: Vec3; p2: Vec3 }>
    currentAngleDeg: number
    cursor: { x: number; y: number }
  } | null>(null)
  const cameraBoundsRef = useRef<CameraBounds | null>(null)
  const previewSvgRef = useRef<SVGSVGElement | null>(null)
  const leftDownRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const undoStackRef = useRef<string[]>([])
  const parsedRef = useRef<ParseResult | null>(null)
  const safeStepRef = useRef(1)
  const selectedSegmentIdRef = useRef<number | null>(null)
  const selectedSegmentIdsRef = useRef<number[]>([])
  const clipboardSegmentsRef = useRef<Segment[] | null>(null)
  const pasteCounterRef = useRef(0)

  const parsed = useMemo(() => parseConstruction(code), [code])

  const safeStep = Math.min(Math.max(1, instructionStep), parsed.maxStep)

  useEffect(() => {
    parsedRef.current = parsed
    safeStepRef.current = safeStep
    selectedSegmentIdRef.current = selectedSegmentId
    selectedSegmentIdsRef.current = selectedSegmentIds
  }, [parsed, safeStep, selectedSegmentId, selectedSegmentIds])

  const drawing = useMemo(
    () =>
      buildStepDrawing(
        parsed.segments,
        parsed.stepMeta,
        safeStep,
        viewportSize.width,
        viewportSize.height,
        viewRotX,
        viewRotZ,
        viewZoom,
        panX,
        panY,
        cameraBoundsRef.current,
      ),
    [parsed, safeStep, viewportSize, viewRotX, viewRotZ, viewZoom, panX, panY],
  )

  useEffect(() => {
    const el = previewSvgRef.current
    if (!el) return

    const updateViewport = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width < 2 || rect.height < 2) return

      // Keep a dense internal buffer matching the visible panel ratio.
      const nextWidth = Math.max(DEFAULT_VIEWPORT_WIDTH, Math.round(rect.width * 2))
      const nextHeight = Math.max(DEFAULT_VIEWPORT_HEIGHT, Math.round(rect.height * 2))
      setViewportSize((prev) =>
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight },
      )
    }

    updateViewport()
    const observer = new ResizeObserver(updateViewport)
    observer.observe(el)
    return () => observer.disconnect()
  }, [showCodePanel])

  useEffect(() => {
    cameraBoundsRef.current = drawing.cameraBounds
  }, [drawing.cameraBounds])

  useEffect(() => {
    setInstructionStep(parsed.maxStep)
  }, [code, parsed.maxStep])

  useEffect(() => {
    if (!activeInsertAsset) {
      setGhostPreview(null)
      return
    }
    const centerPoint = { x: drawing.width / 2, y: drawing.height / 2 }
    setGhostPreview(buildGhostPreviewAt(centerPoint))
  }, [activeInsertAsset, drawing.width, drawing.height])

  const currentMeta = parsed.stepMeta[safeStep] ?? { step: safeStep, amarres: [] }
  const selectedSegment = parsed.segments.find((s) => s.id === selectedSegmentId) || null
  const selectedTransformIds = selectedSegmentIds.length
    ? selectedSegmentIds
    : selectedSegmentId !== null
      ? [selectedSegmentId]
      : []
  const selectedTransformSegments = parsed.segments.filter((s) => selectedTransformIds.includes(s.id))
  const rotationPivot = selectedTransformSegments.length
    ? {
        x: selectedTransformSegments.reduce((acc, s) => acc + s.p1.x + s.p2.x, 0) / (selectedTransformSegments.length * 2),
        y: selectedTransformSegments.reduce((acc, s) => acc + s.p1.y + s.p2.y, 0) / (selectedTransformSegments.length * 2),
        z: selectedTransformSegments.reduce((acc, s) => acc + s.p1.z + s.p2.z, 0) / (selectedTransformSegments.length * 2),
      }
    : null

  function getSelectedIdsForDeletion(): number[] {
    const ids = selectedSegmentIds.length
      ? selectedSegmentIds
      : selectedSegmentId !== null
        ? [selectedSegmentId]
        : []

    if (!ids.length) return []
    const existingIds = new Set(parsed.segments.map((s) => s.id))
    return Array.from(new Set(ids)).filter((id) => existingIds.has(id))
  }

  function deleteSelectedSegments() {
    const idsToDelete = getSelectedIdsForDeletion()
    if (!idsToDelete.length) return

    const idSet = new Set(idsToDelete)
    applyModelUpdate((segments) => {
      for (let i = segments.length - 1; i >= 0; i -= 1) {
        if (idSet.has(segments[i].id)) segments.splice(i, 1)
      }
    })

    setSelectedSegmentIds([])
    setSelectedSegmentId(null)
  }

  function pushUndoSnapshot(currentCode: string) {
    const stack = undoStackRef.current
    if (stack[stack.length - 1] === currentCode) return
    stack.push(currentCode)
    if (stack.length > 80) stack.shift()
  }

  function undoLastModelUpdate() {
    const stack = undoStackRef.current
    if (!stack.length) return
    const previous = stack.pop()
    if (!previous) return
    setCode(previous)
    setSelectedSegmentIds([])
    setSelectedSegmentId(null)
  }

  function copySelectedSegments() {
    const parsedNow = parsedRef.current
    if (!parsedNow) return

    const ids = selectedSegmentIdsRef.current.length
      ? selectedSegmentIdsRef.current
      : selectedSegmentIdRef.current !== null
        ? [selectedSegmentIdRef.current]
        : []
    if (!ids.length) return

    const idSet = new Set(ids)
    const copied = parsedNow.segments
      .filter((segment) => idSet.has(segment.id))
      .map((segment) => ({
        ...segment,
        p1: { ...segment.p1 },
        p2: { ...segment.p2 },
      }))

    if (!copied.length) return
    clipboardSegmentsRef.current = copied
    pasteCounterRef.current = 0
  }

  function pasteCopiedSegments() {
    const clipboard = clipboardSegmentsRef.current
    if (!clipboard?.length) return

    const pasteStep = safeStepRef.current
    pasteCounterRef.current += 1
    const delta = 0.6 * pasteCounterRef.current
    const offset = { x: delta, y: -delta, z: 0 }
    const createdIds: number[] = []

    applyModelUpdate((segments, meta) => {
      let nextId = segments.length ? Math.max(...segments.map((s) => s.id)) + 1 : 1

      for (const src of clipboard) {
        const id = nextId
        nextId += 1
        createdIds.push(id)
        segments.push({
          id,
          type: src.type,
          p1: { x: src.p1.x + offset.x, y: src.p1.y + offset.y, z: src.p1.z + offset.z },
          p2: { x: src.p2.x + offset.x, y: src.p2.y + offset.y, z: src.p2.z + offset.z },
          color: src.color,
          step: pasteStep,
        })
      }

      if (!meta[pasteStep]) {
        meta[pasteStep] = { step: pasteStep, amarres: [], comentario: `Montaje del paso ${pasteStep}` }
      }
    })

    if (!createdIds.length) return
    setSelectedSegmentIds(createdIds)
    setSelectedSegmentId(createdIds[0] ?? null)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key?.toLowerCase() || ''
      const target = event.target as HTMLElement | null
      const isEditable =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      const isMod = event.ctrlKey || event.metaKey

      if (isMod && !isEditable) {
        if (key === 'z' && !event.shiftKey) {
          event.preventDefault()
          undoLastModelUpdate()
          return
        }
        if (key === 'c') {
          event.preventDefault()
          copySelectedSegments()
          return
        }
        if (key === 'v') {
          event.preventDefault()
          pasteCopiedSegments()
          return
        }
      }

      if (key === 'escape') {
        if (lashingPrompt) {
          setLashingPrompt(null)
          return
        }
        if (activeInsertAsset) {
          setActiveInsertAsset(null)
          setGhostPreview(null)
          return
        }
      }

      const isDeleteKey =
        key === 'delete' || key === 'del' || key === 'supr' || key === 'backspace' || event.code === 'Delete'
      if (!isDeleteKey) return
      if (isEditable) return

      if (getSelectedIdsForDeletion().length === 0) return
      event.preventDefault()
      deleteSelectedSegments()
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [selectedSegmentId, selectedSegmentIds, parsed.segments, activeInsertAsset, lashingPrompt])

  useEffect(() => {
    const existingIds = new Set(parsed.segments.map((s) => s.id))
    setLashingNames((prev) => {
      const next: Record<number, string> = {}
      let changed = false
      for (const [k, v] of Object.entries(prev)) {
        const id = Number(k)
        if (existingIds.has(id)) {
          next[id] = v
        } else {
          changed = true
        }
      }
      return changed ? next : prev
    })

    if (lashingPrompt && !existingIds.has(lashingPrompt.segmentId)) {
      setLashingPrompt(null)
    }
  }, [parsed.segments, lashingPrompt])

  function insertAssetAtPosition(asset: InsertAssetKey, center: Vec3): number {
    const type: SegmentType = asset === 'cana' ? 'cana' : asset === 'soga' ? 'soga' : 'palo'
    const color =
      type === 'palo' ? 'rgb(139, 69, 19)' : type === 'cana' ? 'rgb(230, 210, 140)' : 'rgb(210, 180, 140)'
    const half = FIXED_ASSET_LENGTH[asset] / 2
    let createdId = -1

    applyModelUpdate((segments, meta) => {
      const newId = segments.length ? Math.max(...segments.map((s) => s.id)) + 1 : 1
      createdId = newId

      if (asset === 'amarre') {
        segments.push({
          id: newId,
          type: 'soga',
          p1: { x: center.x - half, y: center.y, z: center.z },
          p2: { x: center.x + half, y: center.y, z: center.z },
          color: 'rgb(210, 180, 140)',
          step: safeStep,
        })

        if (!meta[safeStep]) {
          meta[safeStep] = { step: safeStep, amarres: [], comentario: `Montaje del paso ${safeStep}` }
        }
        if (!meta[safeStep].amarres.includes('Amarre')) {
          meta[safeStep].amarres.push('Amarre')
        }
        return
      }

      segments.push({
        id: newId,
        type,
        p1: { x: center.x - half, y: center.y, z: center.z },
        p2: { x: center.x + half, y: center.y, z: center.z },
        color,
        step: safeStep,
      })

      if (!meta[safeStep]) {
        meta[safeStep] = { step: safeStep, amarres: [], comentario: `Montaje del paso ${safeStep}` }
      }
    })

    return createdId
  }

  function insertPresetAtPosition(kind: PresetAssetKey, center: Vec3, centered = true) {
    applyModelUpdate((segments, meta) => {
      const nextId = () => (segments.length ? Math.max(...segments.map((s) => s.id)) + 1 : 1)
      const push = (type: SegmentType, p1: Vec3, p2: Vec3, color: string) => {
        segments.push({
          id: nextId(),
          type,
          p1: centered ? { x: p1.x + center.x, y: p1.y + center.y, z: p1.z + center.z } : p1,
          p2: centered ? { x: p2.x + center.x, y: p2.y + center.y, z: p2.z + center.z } : p2,
          color,
          step: safeStep,
        })
      }

      if (!meta[safeStep]) {
        meta[safeStep] = { step: safeStep, amarres: [], comentario: `Montaje del paso ${safeStep}` }
      }

      if (kind === 'tripode') {
        push('palo', { x: 0, y: 0, z: 4 }, { x: 0, y: 2, z: 0 }, 'rgb(139, 69, 19)')
        push('palo', { x: 0, y: 0, z: 4 }, { x: -1.7, y: -1, z: 0 }, 'rgb(139, 69, 19)')
        push('palo', { x: 0, y: 0, z: 4 }, { x: 1.7, y: -1, z: 0 }, 'rgb(139, 69, 19)')
      }

      if (kind === 'cuapode') {
        push('palo', { x: 0, y: 0, z: 4 }, { x: 1.5, y: 1.5, z: 0 }, 'rgb(139, 69, 19)')
        push('palo', { x: 0, y: 0, z: 4 }, { x: -1.5, y: 1.5, z: 0 }, 'rgb(139, 69, 19)')
        push('palo', { x: 0, y: 0, z: 4 }, { x: -1.5, y: -1.5, z: 0 }, 'rgb(139, 69, 19)')
        push('palo', { x: 0, y: 0, z: 4 }, { x: 1.5, y: -1.5, z: 0 }, 'rgb(139, 69, 19)')
      }

      if (kind === 'escalera') {
        push('palo', { x: -2.5, y: 0, z: 0 }, { x: -1, y: 0, z: 4 }, 'rgb(139, 69, 19)')
        push('palo', { x: -2.5, y: 0.8, z: 0 }, { x: -1, y: 0.8, z: 4 }, 'rgb(139, 69, 19)')
        for (let i = 1; i <= 4; i += 1) {
          const z = i * 0.8
          const x = -2.5 + (1.5 * i) / 5
          push('palo', { x, y: 0, z }, { x, y: 0.8, z }, 'rgb(139, 69, 19)')
        }
      }

      if (kind === 'marco') {
        push('palo', { x: -1.8, y: -1.2, z: 2 }, { x: 1.8, y: -1.2, z: 2 }, 'rgb(139, 69, 19)')
        push('palo', { x: 1.8, y: -1.2, z: 2 }, { x: 1.8, y: 1.2, z: 2 }, 'rgb(139, 69, 19)')
        push('palo', { x: 1.8, y: 1.2, z: 2 }, { x: -1.8, y: 1.2, z: 2 }, 'rgb(139, 69, 19)')
        push('palo', { x: -1.8, y: 1.2, z: 2 }, { x: -1.8, y: -1.2, z: 2 }, 'rgb(139, 69, 19)')
      }

      if (kind === 'amarre') {
        push('soga', { x: -0.3, y: 0, z: 1.4 }, { x: 0.3, y: 0, z: 1.4 }, 'rgb(210, 180, 140)')
        push('soga', { x: 0, y: -0.3, z: 1.4 }, { x: 0, y: 0.3, z: 1.4 }, 'rgb(210, 180, 140)')
        if (!meta[safeStep].amarres.length) meta[safeStep].amarres = ['Cuadrado']
      }
    })
  }

  function activateInsertMode(asset: PlaceableAssetKey) {
    setTool('select')
    setActiveInsertAsset(asset)
    const centerPoint = { x: drawing.width / 2, y: drawing.height / 2 }
    setGhostPreview(buildGhostPreviewAt(centerPoint))
  }

  function isWithinBuildDistance(center: Vec3): boolean {
    if (parsed.segments.length === 0) return true

    let minDistance = Number.POSITIVE_INFINITY
    for (const segment of parsed.segments) {
      minDistance = Math.min(minDistance, distancePointToSegment3D(center, segment.p1, segment.p2))
    }
    return minDistance <= MAX_BUILD_DISTANCE_METERS
  }

  function getRotationBasis(axis: 'x' | 'y' | 'z') {
    if (axis === 'x') return { u: { x: 0, y: 1, z: 0 }, v: { x: 0, y: 0, z: 1 } }
    if (axis === 'y') return { u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 0, z: 1 } }
    return { u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 1, z: 0 } }
  }

  function angleAroundAxisFromCursor(axis: 'x' | 'y' | 'z', pivot: Vec3, point: { x: number; y: number }) {
    const basis = getRotationBasis(axis)
    const sp = drawing.projectWorldToScreen(pivot)
    const su = drawing.projectWorldToScreen({
      x: pivot.x + basis.u.x,
      y: pivot.y + basis.u.y,
      z: pivot.z + basis.u.z,
    })
    const sv = drawing.projectWorldToScreen({
      x: pivot.x + basis.v.x,
      y: pivot.y + basis.v.y,
      z: pivot.z + basis.v.z,
    })

    const ux = su.x - sp.x
    const uy = su.y - sp.y
    const vx = sv.x - sp.x
    const vy = sv.y - sp.y
    const dx = point.x - sp.x
    const dy = point.y - sp.y
    const det = ux * vy - uy * vx

    if (Math.abs(det) < 1e-6) return 0

    const a = (dx * vy - dy * vx) / det
    const b = (ux * dy - uy * dx) / det
    return Math.atan2(b, a)
  }

  function beginRotationDrag(axis: 'x' | 'y' | 'z', clientX: number, clientY: number) {
    if (!rotationPivot || selectedTransformIds.length === 0) return
    const point = getCanvasPointFromClient(clientX, clientY)
    const startAngleRad = angleAroundAxisFromCursor(axis, rotationPivot, point)
    const baseSegments: Record<number, { p1: Vec3; p2: Vec3 }> = {}

    for (const id of selectedTransformIds) {
      const segment = parsed.segments.find((s) => s.id === id)
      if (!segment) continue
      baseSegments[id] = {
        p1: { ...segment.p1 },
        p2: { ...segment.p2 },
      }
    }

    pushUndoSnapshot(code)
    setRotationDrag({
      axis,
      pivot: { ...rotationPivot },
      startAngleRad,
      selectedIds: [...selectedTransformIds],
      baseSegments,
      currentAngleDeg: (startAngleRad * 180) / Math.PI,
      cursor: point,
    })
  }

  function applyModelUpdate(
    mutator: (nextSegments: Segment[], nextMeta: Record<number, StepMeta>) => void,
    options?: { pushHistory?: boolean },
  ) {
    if (options?.pushHistory !== false) {
      pushUndoSnapshot(code)
    }

    const nextSegments = parsed.segments.map((s) => ({ ...s, p1: { ...s.p1 }, p2: { ...s.p2 } }))
    const nextMeta = cloneStepMeta(parsed.stepMeta)
    mutator(nextSegments, nextMeta)

    const nextMaxStep = Math.max(
      1,
      ...nextSegments.map((s) => s.step),
      ...Object.keys(nextMeta).map((k) => Number(k)),
    )

    const rebuilt = buildPythonFromModel(nextSegments, nextMeta, nextMaxStep)
    setCode(rebuilt)
    setInstructionStep((prev) => Math.min(Math.max(1, prev), nextMaxStep))
  }

  async function openGeminiThinking() {
    const continuar = window.confirm(
      'Antes de ir a Gemini: activá manualmente Thinking dentro de Gemini y subí una imagen de tu dibujo (foto o captura) o escribí una descripción clara. ¿Continuar?',
    )
    if (!continuar) return

    const thinkingPrompt = geminiPrompt
    try {
      await navigator.clipboard.writeText(thinkingPrompt)
    } catch {
      // Si el portapapeles falla, igualmente abrimos Gemini
    }

    const geminiUrl = `https://gemini.google.com/app?prompt=${encodeURIComponent(thinkingPrompt)}`
    window.open(geminiUrl, '_blank', 'noopener,noreferrer')
  }

  async function copyGeminiPrompt() {
    await navigator.clipboard.writeText(geminiPrompt)
    setEasyPromptCopied(true)
    setTimeout(() => setEasyPromptCopied(false), 1800)
  }

  async function copyWarningsForGemini() {
    const payload = [
      'ERROR detectado en el parser de la construcción:',
      ...parsed.warnings,
      '',
      'Por favor corrige el script Python manteniendo el formato por pasos y devuelve solo código.',
    ].join('\n')

    await navigator.clipboard.writeText(payload)
    setErrorCopied(true)
    setTimeout(() => setErrorCopied(false), 1800)
  }

  function nextStep() {
    setInstructionStep((prev) => (prev >= parsed.maxStep ? parsed.maxStep : prev + 1))
  }

  function prevStep() {
    setInstructionStep((prev) => (prev <= 1 ? 1 : prev - 1))
  }

  function getCanvasPointFromClient(clientX: number, clientY: number) {
    const svg = previewSvgRef.current
    if (!svg) return { x: drawing.width / 2, y: drawing.height / 2 }
    const rect = svg.getBoundingClientRect()
    const sx = ((clientX - rect.left) / rect.width) * drawing.width
    const sy = ((clientY - rect.top) / rect.height) * drawing.height
    return { x: sx, y: sy }
  }

  function findNearestSegmentAtPoint(clickPoint: { x: number; y: number }) {
    return drawing.lines
      .map((line) => ({
        id: line.id,
        d: distanceToSegment2D(clickPoint, line.as, line.bs),
        da: Math.hypot(clickPoint.x - line.as.x, clickPoint.y - line.as.y),
        db: Math.hypot(clickPoint.x - line.bs.x, clickPoint.y - line.bs.y),
      }))
      .sort((a, b) => a.d - b.d)[0]
  }

  function buildGhostPreviewAt(point: { x: number; y: number }): GhostPreview | null {
    if (!activeInsertAsset) return null

    if (activeInsertAsset === 'amarre') {
      let nearest: { worldPoint: Vec3; screenPoint: { x: number; y: number }; d: number } | null = null
      for (const segment of parsed.segments) {
        if (segment.step > safeStep || segment.type !== 'palo') continue
        const candidates = [segment.p1, segment.p2]
        for (const candidate of candidates) {
          const screenPoint = drawing.projectWorldToScreen(candidate)
          const d = Math.hypot(point.x - screenPoint.x, point.y - screenPoint.y)
          if (!nearest || d < nearest.d) {
            nearest = { worldPoint: candidate, screenPoint, d }
          }
        }
      }

      if (!nearest) {
        return { asset: 'amarre', screen: point, valid: false }
      }

      const valid = nearest.d <= 30
      return {
        asset: 'amarre',
        screen: valid ? nearest.screenPoint : point,
        valid,
        anchorPoint: valid ? nearest.worldPoint : undefined,
      }
    }

    // Invert the screen projection on the ground plane (z=0) so the ghost follows the cursor accurately.
    const o = drawing.projectWorldToScreen({ x: 0, y: 0, z: 0 })
    const px = drawing.projectWorldToScreen({ x: 1, y: 0, z: 0 })
    const py = drawing.projectWorldToScreen({ x: 0, y: 1, z: 0 })
    const vx = { x: px.x - o.x, y: px.y - o.y }
    const vy = { x: py.x - o.x, y: py.y - o.y }
    const sx = point.x - o.x
    const sy = point.y - o.y
    const det = vx.x * vy.y - vx.y * vy.x

    const worldCenter: Vec3 =
      Math.abs(det) < 1e-6
        ? { x: 0, y: 0, z: 0 }
        : {
            x: Math.round((((sx * vy.y - sy * vy.x) / det) * 2)) / 2,
            y: Math.round((((vx.x * sy - vx.y * sx) / det) * 2)) / 2,
            z: 0,
          }

    return {
      asset: activeInsertAsset,
      screen: drawing.projectWorldToScreen(worldCenter),
      valid: isWithinBuildDistance(worldCenter),
      worldCenter,
    }
  }

  function finalizeBoxSelection(rect: BoxSelectRect, shiftKey: boolean) {
    const minX = Math.min(rect.x1, rect.x2)
    const maxX = Math.max(rect.x1, rect.x2)
    const minY = Math.min(rect.y1, rect.y2)
    const maxY = Math.max(rect.y1, rect.y2)

    const inside = (x: number, y: number) => x >= minX && x <= maxX && y >= minY && y <= maxY

    const idsInBox = drawing.lines
      .filter((line) => {
        if (inside(line.as.x, line.as.y) || inside(line.bs.x, line.bs.y)) return true
        const segMinX = Math.min(line.as.x, line.bs.x)
        const segMaxX = Math.max(line.as.x, line.bs.x)
        const segMinY = Math.min(line.as.y, line.bs.y)
        const segMaxY = Math.max(line.as.y, line.bs.y)
        return segMaxX >= minX && segMinX <= maxX && segMaxY >= minY && segMinY <= maxY
      })
      .map((line) => line.id)

    if (shiftKey) {
      setSelectedSegmentIds((prev) => {
        const union = Array.from(new Set([...prev, ...idsInBox]))
        setSelectedSegmentId(union[0] ?? null)
        return union
      })
      return
    }

    setSelectedSegmentIds(idsInBox)
    setSelectedSegmentId(idsInBox[0] ?? null)
  }

  function handlePrimaryClickAt(point: { x: number; y: number }, shiftKey: boolean) {
    if (activeInsertAsset && tool !== 'eraser') {
      const preview = ghostPreview ?? buildGhostPreviewAt(point)
      if (!preview) return
      if (!preview.valid) return

      if (activeInsertAsset === 'amarre') {
        if (!preview.valid || !preview.anchorPoint) return
        const newId = insertAssetAtPosition('amarre', preview.anchorPoint)
        if (newId <= 0) return
        setSelectedSegmentIds([newId])
        setSelectedSegmentId(newId)
        setLashingPrompt({
          segmentId: newId,
          value: lashingNames[newId] || '',
          screenX: preview.screen.x,
          screenY: preview.screen.y,
        })
        setGhostPreview(null)
        setActiveInsertAsset(null)
        return
      }

      if (!preview.worldCenter) return
      if (isPresetInsertAsset(activeInsertAsset)) {
        insertPresetAtPosition(PRESET_INSERT_MAP[activeInsertAsset], preview.worldCenter)
      } else {
        insertAssetAtPosition(activeInsertAsset, preview.worldCenter)
      }
      setGhostPreview(null)
      setActiveInsertAsset(null)
      return
    }

    const nearest = findNearestSegmentAtPoint(point)
    if (!nearest || nearest.d > 12) return

    if (tool === 'eraser') {
      applyModelUpdate((segments) => {
        const idx = segments.findIndex((s) => s.id === nearest.id)
        if (idx >= 0) segments.splice(idx, 1)
      })
      if (selectedSegmentId === nearest.id) setSelectedSegmentId(null)
      setSelectedSegmentIds((prev) => prev.filter((id) => id !== nearest.id))
      return
    }

    if (shiftKey) {
      setSelectedSegmentIds((prev) => {
        const exists = prev.includes(nearest.id)
        const next = exists ? prev.filter((id) => id !== nearest.id) : [...prev, nearest.id]
        const head = next[0] ?? null
        setSelectedSegmentId(head)
        return next
      })
    } else {
      setSelectedSegmentIds([nearest.id])
      setSelectedSegmentId(nearest.id)
      setSelectedEndpoint('both')
    }
  }

  function handleCanvasMouseDown(e: MouseEvent<SVGSVGElement>) {
    if (e.button === 2) {
      e.preventDefault()
      setRightDragStart({ x: e.clientX, y: e.clientY })
      return
    }

    if (e.button === 1) {
      e.preventDefault()
      setMiddleDragStart({ x: e.clientX, y: e.clientY })
      return
    }

    if (e.button !== 0) return
    const point = getCanvasPointFromClient(e.clientX, e.clientY)
    leftDownRef.current = { x: point.x, y: point.y, moved: false }

    if (!activeInsertAsset && tool === 'select') {
      setBoxSelectRect({ x1: point.x, y1: point.y, x2: point.x, y2: point.y })
    }
  }

  function handleCanvasMouseMove(e: MouseEvent<SVGSVGElement>) {
    if (activeInsertAsset) {
      const point = getCanvasPointFromClient(e.clientX, e.clientY)
      setGhostPreview(buildGhostPreviewAt(point))
    }

    if (rotationDrag) {
      const point = getCanvasPointFromClient(e.clientX, e.clientY)
      const rawAngle = angleAroundAxisFromCursor(rotationDrag.axis, rotationDrag.pivot, point)
      const deltaRawDeg = (normalizeRad(rawAngle - rotationDrag.startAngleRad) * 180) / Math.PI
      const deltaDeg = e.ctrlKey ? Math.round(deltaRawDeg / 15) * 15 : deltaRawDeg

      applyModelUpdate(
        (segments) => {
          for (const id of rotationDrag.selectedIds) {
            const segment = segments.find((s) => s.id === id)
            const base = rotationDrag.baseSegments[id]
            if (!segment || !base) continue
            segment.p1 = rotatePointAroundAxis(base.p1, rotationDrag.pivot, rotationDrag.axis, deltaDeg)
            segment.p2 = rotatePointAroundAxis(base.p2, rotationDrag.pivot, rotationDrag.axis, deltaDeg)
          }
        },
        { pushHistory: false },
      )

      const currentDeg = (((rawAngle * 180) / Math.PI) % 360 + 360) % 360
      setRotationDrag((prev) => (prev ? { ...prev, currentAngleDeg: currentDeg, cursor: point } : prev))
      return
    }

    if (gizmoDrag) {
      const dx = e.clientX - gizmoDrag.startX
      const dy = e.clientY - gizmoDrag.startY
      const projectedPx = dx * gizmoDrag.ux + dy * gizmoDrag.uy
      const deltaUnits = projectedPx / Math.max(gizmoDrag.pixelsPerUnit, 0.0001)

      applyModelUpdate((segments) => {
        for (const id of gizmoDrag.selectedIds) {
          const segment = segments.find((s) => s.id === id)
          const basePoint = gizmoDrag.basePoints[id]
          if (!segment || !basePoint) continue

          if (selectedEndpoint === 'p1') {
            segment.p1[gizmoDrag.axis] = basePoint.p1[gizmoDrag.axis] + deltaUnits
          } else if (selectedEndpoint === 'p2') {
            segment.p2[gizmoDrag.axis] = basePoint.p2[gizmoDrag.axis] + deltaUnits
          } else {
            segment.p1[gizmoDrag.axis] = basePoint.p1[gizmoDrag.axis] + deltaUnits
            segment.p2[gizmoDrag.axis] = basePoint.p2[gizmoDrag.axis] + deltaUnits
          }
        }
      }, { pushHistory: false })
      return
    }

    if (rightDragStart) {
      const dx = e.clientX - rightDragStart.x
      const dy = e.clientY - rightDragStart.y
      setViewRotZ((prev) => prev + dx * 0.35)
      setViewRotX((prev) => Math.max(-89, Math.min(89, prev + dy * 0.25)))
      setRightDragStart({ x: e.clientX, y: e.clientY })
      return
    }

    if (middleDragStart) {
      const dx = e.clientX - middleDragStart.x
      const dy = e.clientY - middleDragStart.y
      setPanX((prev) => prev + dx)
      setPanY((prev) => prev + dy)
      setMiddleDragStart({ x: e.clientX, y: e.clientY })
      return
    }

    if (leftDownRef.current && boxSelectRect && !activeInsertAsset && tool === 'select') {
      const point = getCanvasPointFromClient(e.clientX, e.clientY)
      const moved = Math.hypot(point.x - leftDownRef.current.x, point.y - leftDownRef.current.y) > 4
      if (moved) {
        leftDownRef.current = { ...leftDownRef.current, moved: true }
      }
      setBoxSelectRect({ x1: leftDownRef.current.x, y1: leftDownRef.current.y, x2: point.x, y2: point.y })
    }
  }

  function handleCanvasMouseUp(e: MouseEvent<SVGSVGElement>) {
    if (e.button === 2) {
      setRightDragStart(null)
      return
    }

    if (e.button === 1) {
      setMiddleDragStart(null)
      return
    }

    if (e.button !== 0) return
    const point = getCanvasPointFromClient(e.clientX, e.clientY)

    if (leftDownRef.current) {
      const moved =
        leftDownRef.current.moved ||
        Math.hypot(point.x - leftDownRef.current.x, point.y - leftDownRef.current.y) > 4

      if (moved && boxSelectRect && !activeInsertAsset && tool === 'select') {
        finalizeBoxSelection(boxSelectRect, e.shiftKey)
      } else {
        handlePrimaryClickAt(point, e.shiftKey)
      }
    }

    leftDownRef.current = null
    setBoxSelectRect(null)
    setGizmoDrag(null)
    setRotationDrag(null)
  }

  function resetView() {
    setViewRotX(BASE_VIEW_ROT_X)
    setViewRotZ(BASE_VIEW_ROT_Z)
    setViewZoom(1)
    setPanX(0)
    setPanY(0)
    cameraBoundsRef.current = null
  }

  function setFixedCameraView(view: 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west') {
    const byView: Record<typeof view, { rotX: number; rotZ: number }> = {
      top: { rotX: -89, rotZ: 0 },
      bottom: { rotX: 89, rotZ: 0 },
      north: { rotX: 0, rotZ: 90 },
      south: { rotX: 0, rotZ: 180 },
      east: { rotX: 0, rotZ: 0 },
      west: { rotX: 0, rotZ: -90 },
    }

    setViewRotX(byView[view].rotX)
    setViewRotZ(byView[view].rotZ)
    setViewZoom(1)
    setPanX(0)
    setPanY(0)
    cameraBoundsRef.current = null
  }

  function handleCanvasWheel(e: WheelEvent<SVGSVGElement>) {
    e.preventDefault()

    if (e.ctrlKey) {
      return
    }

    // Alt o Shift + wheel => mover camara (pan)
    if (e.altKey || e.shiftKey) {
      if (e.shiftKey && Math.abs(e.deltaX) < 0.001) {
        // Shift+wheel suele representar scroll horizontal en mouse tradicional
        setPanX((prev) => prev - e.deltaY * 0.35)
      } else {
        setPanX((prev) => prev - e.deltaX * 0.35)
        setPanY((prev) => prev - e.deltaY * 0.35)
      }
      return
    }

    // Wheel normal => zoom in/out
    const zoomFactor = Math.exp(-e.deltaY * 0.0015)
    setViewZoom((prev) => Math.max(0.35, Math.min(4, prev * zoomFactor)))
  }

  function addStep() {
    applyModelUpdate((_segments, meta) => {
      const next = parsed.maxStep + 1
      meta[next] = { step: next, amarres: [], comentario: `Paso ${next}` }
    })
    setInstructionStep(parsed.maxStep + 1)
  }

  function removeStep(step: number) {
    if (parsed.maxStep <= 1) return
    applyModelUpdate((segments, meta) => {
      const filtered = segments.filter((s) => s.step !== step)
      const shifted = filtered.map((s) => ({
        ...s,
        step: s.step > step ? s.step - 1 : s.step,
      }))
      segments.length = 0
      segments.push(...shifted)

      const nextMeta: Record<number, StepMeta> = {}
      for (const [k, value] of Object.entries(meta)) {
        const n = Number(k)
        if (n === step) continue
        const target = n > step ? n - 1 : n
        nextMeta[target] = { ...value, step: target, amarres: [...value.amarres] }
      }
      Object.keys(meta).forEach((k) => delete meta[Number(k)])
      Object.entries(nextMeta).forEach(([k, v]) => {
        meta[Number(k)] = v
      })
    })
    setInstructionStep((prev) => Math.max(1, Math.min(prev, parsed.maxStep - 1)))
  }

  function moveStep(step: number, dir: -1 | 1) {
    const target = step + dir
    if (target < 1 || target > parsed.maxStep) return
    applyModelUpdate((segments, meta) => {
      for (const s of segments) {
        if (s.step === step) s.step = -999
      }
      for (const s of segments) {
        if (s.step === target) s.step = step
      }
      for (const s of segments) {
        if (s.step === -999) s.step = target
      }

      const a = meta[step] ?? { step, amarres: [] }
      const b = meta[target] ?? { step: target, amarres: [] }
      meta[step] = { ...b, step, amarres: [...b.amarres] }
      meta[target] = { ...a, step: target, amarres: [...a.amarres] }
    })
    setInstructionStep(target)
  }

  function handleCanvasContextMenu(e: MouseEvent<SVGSVGElement>) {
    e.preventDefault()
  }

  function drawPdfStepInCell(
    pdf: jsPDF,
    step: number,
    maxStep: number,
    lines: ReturnType<typeof buildStepDrawing>['lines'],
    meta: StepMeta,
    cellX: number,
    cellY: number,
    cellWidth: number,
    cellHeight: number,
  ) {
    const padding = 10
    const textLeft = cellX + padding
    const textTop = cellY + padding

    pdf.setDrawColor(180)
    pdf.rect(cellX, cellY, cellWidth, cellHeight)

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.text(`Paso ${step}/${maxStep}`, textLeft, textTop + 8)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    const comentario = meta.comentario || 'Sin comentario para este paso'
    const comentarioLines = pdf.splitTextToSize(`Comentario: ${comentario}`, cellWidth - padding * 2)
    const comentarioY = textTop + 21
    pdf.text(comentarioLines.slice(0, 2), textLeft, comentarioY)

    const amarres = meta.amarres.length ? meta.amarres.join(', ') : 'No especificado'
    const amarresLines = pdf.splitTextToSize(`Amarres: ${amarres}`, cellWidth - padding * 2)
    const amarresY = comentarioY + Math.min(comentarioLines.length, 2) * 9
    pdf.text(amarresLines.slice(0, 1), textLeft, amarresY)

    const cMin = typeof meta.constructoresMin === 'number' ? meta.constructoresMin : '-'
    const cMax = typeof meta.constructoresMax === 'number' ? meta.constructoresMax : '-'
    const constructoresY = amarresY + 9
    pdf.text(`Constructores: min ${cMin} / max ${cMax}`, textLeft, constructoresY)

    const canvasTop = constructoresY + 8
    const canvasHeight = Math.max(24, cellHeight - (canvasTop - cellY) - padding)
    const canvasWidth = cellWidth - padding * 2
    const canvasLeft = cellX + padding
    pdf.setDrawColor(210)
    pdf.rect(canvasLeft, canvasTop, canvasWidth, canvasHeight)

    for (const line of lines) {
      const shouldUseGray = line.isPrevious && step < maxStep
      const [r, g, b] = shouldUseGray ? [158, 158, 158] : extractRgb(line.color)
      pdf.setDrawColor(r, g, b)
      pdf.setLineWidth(line.type === 'tabla' ? 6.0 : line.type === 'cana' ? 1.3 : line.type === 'soga' ? 0.8 : 1.0)
      const x1 = canvasLeft + (line.as.x / 840) * canvasWidth
      const y1 = canvasTop + (line.as.y / 560) * canvasHeight
      const x2 = canvasLeft + (line.bs.x / 840) * canvasWidth
      const y2 = canvasTop + (line.bs.y / 560) * canvasHeight
      pdf.line(x1, y1, x2, y2)
    }
  }

  async function downloadInstructionsPdf() {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const marginX = 24
    const marginY = 20
    const gapX = 14
    const gapY = 14
    const cols = 2
    const rows = 2
    const cellWidth = (pageWidth - marginX * 2 - gapX * (cols - 1)) / cols
    const cellHeight = (pageHeight - marginY * 2 - gapY * (rows - 1)) / rows

    for (let pageStart = 1; pageStart <= parsed.maxStep; pageStart += 4) {
      if (pageStart > 1) pdf.addPage('a4', 'landscape')

      for (let idx = 0; idx < 4; idx += 1) {
        const step = pageStart + idx
        if (step > parsed.maxStep) break

        const row = Math.floor(idx / cols)
        const col = idx % cols
        const cellX = marginX + col * (cellWidth + gapX)
        const cellY = marginY + row * (cellHeight + gapY)

        const stepDrawing = buildStepDrawing(
          parsed.segments,
          parsed.stepMeta,
          step,
          840,
          560,
          BASE_VIEW_ROT_X,
          BASE_VIEW_ROT_Z,
          1,
          0,
          0,
          null,
        )
        const meta = parsed.stepMeta[step] ?? { step, amarres: [] }
        drawPdfStepInCell(pdf, step, parsed.maxStep, stepDrawing.lines, meta, cellX, cellY, cellWidth, cellHeight)
      }
    }

    pdf.save('manual_instrucciones_scout.pdf')
  }

  return (
    <>
    <div className="plannerShell">
      <header className="plannerTopBar">
        <div className="topLeftCluster">
          <div className="brandWrap">
            <span className="brandLogo">ScoutCAD</span>
            <span className="brandTitle">Editor</span>
          </div>
          <div className="modeSwitcher">
            <button className="toolActive">Design</button>
            <button>Assets</button>
            <button>Steps</button>
          </div>
        </div>
        <button className="easyModeButton" onClick={() => {
          setShowEasyMode(true)
          setShowCodePanel(true)
        }}>
          MODO FACIL
        </button>
        <div className="topActions">
          <button>Importar</button>
          <button>Exportar</button>
          <button onClick={() => setShowCodePanel((v) => !v)}>{showCodePanel ? 'Ocultar Script' : 'Ver Script'}</button>
          <button onClick={downloadInstructionsPdf}>Export PDF</button>
        </div>
      </header>

      <div className="plannerBody">
        <aside className="leftDock">
          <div className="leftTabs">
            <button className={leftPanelTab === 'assets' ? 'toolActive' : ''} onClick={() => setLeftPanelTab('assets')}>Assets</button>
            <button className={leftPanelTab === 'steps' ? 'toolActive' : ''} onClick={() => setLeftPanelTab('steps')}>Steps</button>
          </div>

          {leftPanelTab === 'assets' && (
            <div className="leftSection">
              <div className="leftSectionHeader">
                <h4>Shape Library</h4>
                <input className="assetSearch" placeholder="Buscar asset" />
              </div>
              <div className="assetGrid">
                <p className="assetGroupTitle">Objetos básicos</p>
                <button
                  className="assetOnePress"
                  onClick={() => activateInsertMode('palo_largo')}
                >
                  Palo largo ({FIXED_ASSET_LENGTH.palo_largo}m)
                </button>
                <button
                  className="assetOnePress"
                  onClick={() => activateInsertMode('palo_corto')}
                >
                  Palo corto ({FIXED_ASSET_LENGTH.palo_corto}m)
                </button>
                <button
                  className="assetOnePress"
                  onClick={() => activateInsertMode('cana')}
                >
                  Caña ({FIXED_ASSET_LENGTH.cana}m)
                </button>
                <button
                  className="assetOnePress"
                  onClick={() => activateInsertMode('soga')}
                >
                  Soga ({FIXED_ASSET_LENGTH.soga}m)
                </button>
                <button
                  className="assetOnePress"
                  onClick={() => activateInsertMode('amarre')}
                >
                  Amarre
                </button>
                <p className="assetGroupTitle">Estructuras rápidas</p>
                <button onClick={() => activateInsertMode('preset_tripode')}>+ Trípode</button>
                <button onClick={() => activateInsertMode('preset_cuapode')}>+ Cuápode</button>
                <button onClick={() => activateInsertMode('preset_escalera')}>+ Escalera</button>
                <button onClick={() => activateInsertMode('preset_marco')}>+ Marco</button>
                <button onClick={() => activateInsertMode('preset_amarre')}>+ Amarre</button>
              </div>
              <p className="toolHint">
                Por defecto, click izquierdo selecciona. Si presionás un asset, aparece el fantasma para colocarlo una vez.
              </p>
            </div>
          )}

          {leftPanelTab === 'steps' && (
            <div className="leftSection">
              <h4>Step Track</h4>
              <button onClick={addStep}>+ Paso</button>
              {Array.from({ length: parsed.maxStep }, (_, i) => i + 1).map((step) => (
                <div key={`left-step-${step}`} className="stepRow">
                  <button className={safeStep === step ? 'toolActive' : ''} onClick={() => setInstructionStep(step)}>Paso {step}</button>
                  <button onClick={() => moveStep(step, -1)}>↑</button>
                  <button onClick={() => moveStep(step, 1)}>↓</button>
                  <button className="danger" onClick={() => removeStep(step)}>×</button>
                </div>
              ))}
            </div>
          )}
        </aside>

        <div className="workspaceArea">
          <div className={`layout ${showCodePanel ? 'withCodePanel' : 'withoutCodePanel'}`}>
      <section className="previewPanel">
        <header className="panelHeader">
          <h2>Instrucciones (preview 3D)</h2>
          <div className="viewControls">
            <span>
              Paso {safeStep}/{parsed.maxStep}
            </span>
            <span>{parsed.segments.length} elementos</span>
            <button onClick={prevStep}>Prev</button>
            <button onClick={nextStep}>Next</button>
            <button onClick={() => setShowStepManager((v) => !v)}>
              {showStepManager ? 'Ocultar pasos' : 'Agregar/remover pasos'}
            </button>
            <button onClick={resetView}>Reset vista</button>
          </div>
        </header>

        <p className="toolHint">
          {activeInsertAsset
            ? `Modo inserción temporal: ${activeInsertAsset.replace('preset_', '').replace('_', ' ')} fantasma. Click izquierdo coloca una vez.`
            : 'Modo selección por defecto: click izquierdo selecciona, arrastre izquierdo hace caja, click derecho rota y click medio desplaza. Delete borra selección.'}
        </p>

        {showStepManager && (
          <div className="stepManager">
            <div className="stepManagerHeader">
              <strong>Gestión de pasos</strong>
              <button onClick={addStep}>+ Paso</button>
            </div>
            {Array.from({ length: parsed.maxStep }, (_, i) => i + 1).map((step) => {
              const count = parsed.segments.filter((s) => s.step === step).length
              return (
                <div key={step} className="stepRow">
                  <button className={safeStep === step ? 'toolActive' : ''} onClick={() => setInstructionStep(step)}>
                    Paso {step}
                  </button>
                  <span>{count} elementos</span>
                  <button onClick={() => moveStep(step, -1)}>↑</button>
                  <button onClick={() => moveStep(step, 1)}>↓</button>
                  <button className="danger" onClick={() => removeStep(step)}>Eliminar</button>
                </div>
              )
            })}
          </div>
        )}

        <div className="previewViewport">
          <svg
            ref={previewSvgRef}
            className={`previewCanvas ${rightDragStart || middleDragStart || gizmoDrag ? 'dragging' : ''}`}
            style={{ cursor: activeInsertAsset ? 'crosshair' : rightDragStart || middleDragStart ? 'grabbing' : 'default' }}
            viewBox={`0 0 ${drawing.width} ${drawing.height}`}
            preserveAspectRatio="xMidYMid meet"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={() => {
              leftDownRef.current = null
              setBoxSelectRect(null)
              setRightDragStart(null)
              setMiddleDragStart(null)
              setGizmoDrag(null)
              setRotationDrag(null)
            }}
            onWheel={handleCanvasWheel}
            onContextMenu={handleCanvasContextMenu}
          >
            <rect x={0} y={0} width={drawing.width} height={drawing.height} fill="#f5f5f5" />
            {drawing.floorGrid.map((g, i) => (
              <line key={`gf-${i}`} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="#c6ccd4" strokeWidth={0.7} />
            ))}
            {drawing.wallGrid.map((g, i) => (
              <line key={`gw-${i}`} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="#d5d9df" strokeWidth={0.7} />
            ))}

            {ghostPreview && ghostPreview.asset !== 'amarre' && ghostPreview.worldCenter && (
              (() => {
                if (isPresetInsertAsset(ghostPreview.asset)) {
                  return (
                    <g>
                      <circle
                        cx={ghostPreview.screen.x}
                        cy={ghostPreview.screen.y}
                        r={18}
                        fill={ghostPreview.valid ? 'rgba(34, 197, 94, 0.14)' : 'rgba(239, 68, 68, 0.14)'}
                        stroke={ghostPreview.valid ? '#16a34a' : '#ef4444'}
                        strokeWidth={2}
                        strokeDasharray="6 4"
                      />
                      <text
                        x={ghostPreview.screen.x}
                        y={ghostPreview.screen.y + 4}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight={700}
                        fill={ghostPreview.valid ? '#166534' : '#991b1b'}
                      >
                        {PRESET_GHOST_LABEL[ghostPreview.asset]}
                      </text>
                    </g>
                  )
                }

                const half = FIXED_ASSET_LENGTH[ghostPreview.asset] / 2
                const a = drawing.projectWorldToScreen({
                  x: ghostPreview.worldCenter.x - half,
                  y: ghostPreview.worldCenter.y,
                  z: ghostPreview.worldCenter.z,
                })
                const b = drawing.projectWorldToScreen({
                  x: ghostPreview.worldCenter.x + half,
                  y: ghostPreview.worldCenter.y,
                  z: ghostPreview.worldCenter.z,
                })
                return (
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={ghostPreview.valid ? '#0f766e' : '#b91c1c'}
                    strokeWidth={3}
                    strokeDasharray="6 5"
                    opacity={0.55}
                  />
                )
              })()
            )}

            {ghostPreview && ghostPreview.asset === 'amarre' && (
              <circle
                cx={ghostPreview.screen.x}
                cy={ghostPreview.screen.y}
                r={6}
                fill={ghostPreview.valid ? '#14b8a6' : '#ef4444'}
                stroke="#0f172a"
                strokeWidth={1}
                opacity={0.7}
              />
            )}

            {boxSelectRect && (
              <rect
                x={Math.min(boxSelectRect.x1, boxSelectRect.x2)}
                y={Math.min(boxSelectRect.y1, boxSelectRect.y2)}
                width={Math.max(1, Math.abs(boxSelectRect.x2 - boxSelectRect.x1))}
                height={Math.max(1, Math.abs(boxSelectRect.y2 - boxSelectRect.y1))}
                className="boxSelectRect"
              />
            )}

            {drawing.lines.map((line) => (
              <g key={line.id}>
                <line
                  x1={line.as.x}
                  y1={line.as.y}
                  x2={line.bs.x}
                  y2={line.bs.y}
                  stroke={line.isPrevious && safeStep < parsed.maxStep ? '#9e9e9e' : line.color}
                  strokeWidth={line.type === 'tabla' ? 15 : line.type === 'cana' ? 4 : line.type === 'soga' ? 2 : 3}
                  strokeDasharray={line.type === 'soga' ? '6 4' : undefined}
                  strokeLinecap="round"
                />
                {(selectedSegmentId === line.id || selectedSegmentIds.includes(line.id)) && (
                  <>
                    <line x1={line.as.x} y1={line.as.y} x2={line.bs.x} y2={line.bs.y} stroke="#111827" strokeWidth={7} opacity={0.12} />
                    <circle cx={line.as.x} cy={line.as.y} r={selectedEndpoint === 'p1' || selectedEndpoint === 'both' ? 7 : 5} fill="#ef4444" />
                    <circle cx={line.bs.x} cy={line.bs.y} r={selectedEndpoint === 'p2' || selectedEndpoint === 'both' ? 7 : 5} fill="#3b82f6" />
                  </>
                )}
              </g>
            ))}

            {selectedSegment && (() => {
            const base =
              selectedEndpoint === 'p1'
                ? selectedSegment.p1
                : selectedEndpoint === 'p2'
                  ? selectedSegment.p2
                  : {
                      x: (selectedSegment.p1.x + selectedSegment.p2.x) / 2,
                      y: (selectedSegment.p1.y + selectedSegment.p2.y) / 2,
                      z: (selectedSegment.p1.z + selectedSegment.p2.z) / 2,
                    }
            const axes: Array<{ axis: 'x' | 'y' | 'z'; color: string; vec: Vec3 }> = [
              { axis: 'x', color: '#ef4444', vec: { x: 0.9, y: 0, z: 0 } },
              { axis: 'y', color: '#22c55e', vec: { x: 0, y: 0.9, z: 0 } },
              { axis: 'z', color: '#3b82f6', vec: { x: 0, y: 0, z: 0.9 } },
            ]

              const sp = drawing.projectWorldToScreen(base)
              return (
                <g>
                  {axes.map((a) => {
                  const tp = drawing.projectWorldToScreen({
                    x: base.x + a.vec.x,
                    y: base.y + a.vec.y,
                    z: base.z + a.vec.z,
                  })
                  const vx = tp.x - sp.x
                  const vy = tp.y - sp.y
                  const len = Math.max(1, Math.hypot(vx, vy))
                  const ux = vx / len
                  const uy = vy / len
                  const ah = 8
                  const aw = 4
                  const hx = tp.x - ux * ah
                  const hy = tp.y - uy * ah
                  const px = -uy
                  const py = ux
                  const p1x = hx + px * aw
                  const p1y = hy + py * aw
                  const p2x = hx - px * aw
                  const p2y = hy - py * aw

                    return (
                      <g
                        key={a.axis}
                        className="gizmoArrow"
                        onMouseDown={(evt) => {
                        evt.stopPropagation()
                        evt.preventDefault()
                        const currentIds = selectedSegmentIds.length
                          ? [...selectedSegmentIds]
                          : selectedSegmentId
                            ? [selectedSegmentId]
                            : []
                        if (currentIds.length === 0) return

                        const basePoints: Record<number, { p1: Vec3; p2: Vec3 }> = {}
                        for (const id of currentIds) {
                          const seg = parsed.segments.find((s) => s.id === id)
                          if (!seg) continue
                          basePoints[id] = {
                            p1: { ...seg.p1 },
                            p2: { ...seg.p2 },
                          }
                        }

                        const pixelsPerUnit = Math.max(1, len / 0.9)

                          setGizmoDrag({
                            axis: a.axis,
                            ux,
                            uy,
                            startX: evt.clientX,
                            startY: evt.clientY,
                            pixelsPerUnit,
                            selectedIds: currentIds,
                            basePoints,
                          })
                        }}
                      >
                        <line x1={sp.x} y1={sp.y} x2={tp.x} y2={tp.y} stroke={a.color} strokeWidth={2.5} />
                        <polygon points={`${tp.x},${tp.y} ${p1x},${p1y} ${p2x},${p2y}`} fill={a.color} />
                      </g>
                    )
                  })}
                </g>
              )
            })()}

            {rotationPivot && (() => {
              const arcDefs: Array<{ axis: 'x' | 'y' | 'z'; color: string; radius: number }> = [
                { axis: 'x', color: '#ef4444', radius: 1.05 },
                { axis: 'y', color: '#16a34a', radius: 1.25 },
                { axis: 'z', color: '#2563eb', radius: 1.45 },
              ]
              return (
                <g>
                  {arcDefs.map((def) => {
                    const basis = getRotationBasis(def.axis)
                    const points: Array<{ x: number; y: number }> = []
                    for (let i = 0; i <= 24; i += 1) {
                      const t = -Math.PI * 0.88 + (i / 24) * (Math.PI * 1.76)
                      const wp = {
                        x: rotationPivot.x + def.radius * (basis.u.x * Math.cos(t) + basis.v.x * Math.sin(t)),
                        y: rotationPivot.y + def.radius * (basis.u.y * Math.cos(t) + basis.v.y * Math.sin(t)),
                        z: rotationPivot.z + def.radius * (basis.u.z * Math.cos(t) + basis.v.z * Math.sin(t)),
                      }
                      points.push(drawing.projectWorldToScreen(wp))
                    }

                    const pathData = points
                      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
                      .join(' ')

                    const tail = points[points.length - 2]
                    const head = points[points.length - 1]
                    const vx = head.x - tail.x
                    const vy = head.y - tail.y
                    const len = Math.max(1, Math.hypot(vx, vy))
                    const ux = vx / len
                    const uy = vy / len
                    const px = -uy
                    const py = ux
                    const ah = 9
                    const aw = 5
                    const hx = head.x - ux * ah
                    const hy = head.y - uy * ah
                    const p1x = hx + px * aw
                    const p1y = hy + py * aw
                    const p2x = hx - px * aw
                    const p2y = hy - py * aw

                    return (
                      <g
                        key={`rot-${def.axis}`}
                        className="gizmoRotate"
                        onMouseDown={(evt) => {
                          evt.stopPropagation()
                          evt.preventDefault()
                          beginRotationDrag(def.axis, evt.clientX, evt.clientY)
                        }}
                      >
                        <path d={pathData} stroke={def.color} fill="none" strokeWidth={2.2} />
                        <polygon points={`${head.x},${head.y} ${p1x},${p1y} ${p2x},${p2y}`} fill={def.color} />
                      </g>
                    )
                  })}
                </g>
              )
            })()}
          </svg>

          <div className="cameraDock" aria-label="Vistas fijas de cámara">
            <button className="camTop" onClick={() => setFixedCameraView('top')}>Arriba</button>
            <button className="camNorth" onClick={() => setFixedCameraView('north')}>N</button>
            <button className="camWest" onClick={() => setFixedCameraView('west')}>O</button>
            <button className="camCenter" onClick={resetView}>Reset</button>
            <button className="camEast" onClick={() => setFixedCameraView('east')}>E</button>
            <button className="camSouth" onClick={() => setFixedCameraView('south')}>S</button>
            <button className="camBottom" onClick={() => setFixedCameraView('bottom')}>Abajo</button>
          </div>

          {rotationDrag && (
            <div
              className="rotationHud"
              style={{
                left: `${rotationDrag.cursor.x}px`,
                top: `${Math.max(12, rotationDrag.cursor.y - 30)}px`,
              }}
            >
              {Math.round(rotationDrag.currentAngleDeg)}°
            </div>
          )}

          {lashingPrompt && (
            <div
              className="lashingNameBubble"
              style={{ left: `${Math.max(6, lashingPrompt.screenX + 12)}px`, top: `${Math.max(6, lashingPrompt.screenY + 12)}px` }}
            >
              <label>Escribir el nombre del amarre</label>
              <input
                autoFocus
                value={lashingPrompt.value}
                onChange={(ev) => setLashingPrompt((prev) => (prev ? { ...prev, value: ev.target.value } : prev))}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter') {
                    setLashingNames((prev) => ({ ...prev, [lashingPrompt.segmentId]: lashingPrompt.value.trim() }))
                    setLashingPrompt(null)
                  }
                }}
              />
              <div className="lashingNameActions">
                <button
                  onClick={() => {
                    setLashingNames((prev) => ({ ...prev, [lashingPrompt.segmentId]: lashingPrompt.value.trim() }))
                    setLashingPrompt(null)
                  }}
                >
                  OK
                </button>
                <button onClick={() => setLashingPrompt(null)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>

        {selectedSegment && (
          <div className="gizmoPanel">
            <div className="gizmoHeader">
              <strong>Elemento #{selectedSegment.id} ({selectedSegment.type})</strong>
              <div>
                <button className={selectedEndpoint === 'both' ? 'toolActive' : ''} onClick={() => setSelectedEndpoint('both')}>Entero</button>
                <button className={selectedEndpoint === 'p1' ? 'toolActive' : ''} onClick={() => setSelectedEndpoint('p1')}>Inicio</button>
                <button className={selectedEndpoint === 'p2' ? 'toolActive' : ''} onClick={() => setSelectedEndpoint('p2')}>Final</button>
              </div>
            </div>
            <p className="toolHint">Flechas rectas: mover por eje. Flechas curvas: rotar por eje. Con Ctrl se ancla cada 15°.</p>
          </div>
        )}

        <div className="stepInfo">
          <p>
            <strong>Comentario:</strong> {currentMeta.comentario || 'Sin comentario para este paso'}
          </p>
          <p>
            <strong>Amarres:</strong>{' '}
            {currentMeta.amarres.length ? currentMeta.amarres.join(', ') : 'No especificado'}
          </p>
          <p>
            <strong>Constructores:</strong> min{' '}
            {typeof currentMeta.constructoresMin === 'number' ? currentMeta.constructoresMin : '-'} / max{' '}
            {typeof currentMeta.constructoresMax === 'number' ? currentMeta.constructoresMax : '-'}
          </p>
        </div>

        {parsed.warnings.length > 0 && (
          <div className="warnings">
            <div className="warningsHeader">
              <h3>⚠️ ERROR detectado</h3>
              <button onClick={copyWarningsForGemini}>{errorCopied ? 'Error copiado' : 'Copiar error'}</button>
            </div>
            <p className="warningsLead">
              Para arreglarlo rápido: copiá el error y pegalo en el chat de Gemini para que te corrija el script.
            </p>
            {parsed.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}
      </section>

      {showCodePanel && (
      <section className="editorPanel">
        <header className="panelHeader">
          <h2>Código Python</h2>
          <button onClick={() => setCode(starterCode)}>Restaurar base</button>
        </header>

        <textarea
          className="codeBox"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />

        <div className="promptBox">
          <div className="promptHeader">
            <h3>Gemini</h3>
            <div className="promptActions">
              <button
                className="helpButton"
                title="Ayuda"
                aria-label="Mostrar ayuda de uso"
                onClick={() => setShowHelp((prev) => !prev)}
              >
                ?
              </button>
            </div>
          </div>
          {showHelp && (
            <div className="helpBox">
              <p>1) Abrí MODO FACIL para usar la guía completa de Gemini.</p>
              <p>2) En Gemini, activá manualmente Thinking (no se activa solo).</p>
              <p>3) Copiá el código Python generado y pegalo en este panel.</p>
              <p>4) La preview se actualiza automáticamente al pegar.</p>
            </div>
          )}
          <p>
            Usá MODO FACIL para generar código con Gemini y pegarlo aquí.
          </p>
        </div>
      </section>
      )}
    </div>
        </div>
      </div>
    </div>
    {showEasyMode && (
      <div className="easyModeOverlay" onClick={() => setShowEasyMode(false)}>
        <div className="easyModeModal" onClick={(e) => e.stopPropagation()}>
          <div className="easyModeHeader">
            <h3>MODO FACIL - Gemini</h3>
            <button onClick={() => setShowEasyMode(false)}>Cerrar</button>
          </div>
          <p>
            Para mejores resultados, en Gemini activa Thinking y adjunta contexto completo:
            explicaciones de la construccion, instrucciones por paso, tipos de amarres y fotos de los dibujos.
          </p>
          <ol>
            <li>Activa Thinking en Gemini antes de enviar.</li>
            <li>Adjunta fotos o capturas claras de la estructura.</li>
            <li>Describe pasos, materiales y amarres esperados.</li>
            <li>Pega la prompt base de abajo y agrega tus detalles.</li>
          </ol>
          <p>
            Al abrir MODO FACIL se muestra automáticamente el panel de código en la web. Ahí vas a pegar la respuesta final de Gemini.
          </p>
          <ol>
            <li>En Gemini pedí que responda solo con código Python.</li>
            <li>En Gemini, copiá todo el código generado.</li>
            <li>Volvé a esta web y pegalo en el panel Código Python (columna derecha).</li>
            <li>La previsualización se actualiza automáticamente al pegar el código.</li>
          </ol>
          <textarea className="easyPromptBox" readOnly value={geminiPrompt} />
          <div className="easyModeActions">
            <button onClick={copyGeminiPrompt}>{easyPromptCopied ? 'Prompt copiada' : 'Copiar prompt'}</button>
            <button className="btnGemini" onClick={openGeminiThinking}>Abrir Gemini</button>
          </div>
        </div>
      </div>
    )}
  </>
  )
}

function extractRgb(color: string): [number, number, number] {
  const m = color.match(/rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)/i)
  if (!m) return [120, 120, 120]
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

export default App
/* import { MouseEvent, useMemo, useState } from 'react'
import './App.css'

type Vec3 = { x: number; y: number; z: number }
type SegmentType = 'palo' | 'soga' | 'cana'

interface Segment {
  id: number
  type: SegmentType
  p1: Vec3
  p2: Vec3
  color: string
}

const starterCode = `from engine import Engine3D

def main():
    engine = Engine3D()
    engine.set_modo_rapido(True)

    # Estructura simple de ejemplo
    engine.palo((0, 0, 0), (0, 0, 2), (255, 0, 0), etiqueta="V1")
    engine.palo((1, 0, 0), (1, 0, 2), (255, 0, 0), etiqueta="V2")
    engine.palo((0, 1, 0), (0, 1, 2), (255, 0, 0), etiqueta="V3")
    engine.palo((1, 1, 0), (1, 1, 2), (255, 0, 0), etiqueta="V4")

    engine.palo((0, 0, 2), (1, 0, 2), (0, 255, 0), etiqueta="H1")
    engine.palo((1, 0, 2), (1, 1, 2), (0, 255, 0), etiqueta="H2")
    engine.palo((1, 1, 2), (0, 1, 2), (0, 255, 0), etiqueta="H3")
    engine.palo((0, 1, 2), (0, 0, 2), (0, 255, 0), etiqueta="H4")

    engine.show(mostrar_intersecciones=True)

if __name__ == "__main__":
    main()
`

const geminiPrompt = `Actúa como generador de código Python para un motor 3D Scout.

OBJETIVO:
- Dada una imagen de una estructura Scout, devolver SOLO código Python válido (sin explicación) para recrearla.

FORMATO OBLIGATORIO DEL CÓDIGO:
1) Debe iniciar con:
from engine import Engine3D

def main():
    engine = Engine3D()
    engine.set_modo_rapido(True)

2) Definir palos/sogas/cañas EXCLUSIVAMENTE con estas llamadas:
engine.palo((x1, y1, z1), (x2, y2, z2), (r, g, b), etiqueta="...")
engine.soga((x1, y1, z1), (x2, y2, z2), (r, g, b), etiqueta="...")
engine.cana((x1, y1, z1), (x2, y2, z2), (r, g, b), etiqueta="...")

3) Coordenadas y colores:
- Coordenadas numéricas (enteros o decimales) en escala corta y consistente.
- z es altura vertical.
- Colores RGB enteros entre 0 y 255.
- Se permite definir constantes de color, por ejemplo: COL_PALO = (139, 69, 19)

4) Incluir al final:
    engine.show(mostrar_intersecciones=True)

if __name__ == "__main__":
    main()

REGLAS CRÍTICAS:
- No uses texto fuera del bloque de código.
- No uses markdown.
- No inventes APIs distintas.
- Si algo es ambiguo en la imagen, elige la opción más simple y estable estructuralmente.
- Preferir líneas rectas y simetría cuando aplique.

SALIDA ESPERADA:
- Un único script Python ejecutable, listo para pegar.`

function parseSegments(code: string): { segments: Segment[]; warnings: string[] } {
  const warnings: string[] = []
  const segments: Segment[] = []

  const colorConstants = new Map<string, [number, number, number]>()
  const constRegex =
    /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/gm
  let constMatch: RegExpExecArray | null
  while ((constMatch = constRegex.exec(code)) !== null) {
    const name = constMatch[1]
    const rgb: [number, number, number] = [
      Number(constMatch[2]),
      Number(constMatch[3]),
      Number(constMatch[4]),
    ]
    colorConstants.set(name, rgb)
  }

  const lineRegex =
    /engine\.(palo|soga|cana)\s*\(\s*\(([^)]+)\)\s*,\s*\(([^)]+)\)\s*,\s*(\([^)]*\)|[A-Za-z_][A-Za-z0-9_]*)/g

  let match: RegExpExecArray | null
  let index = 1
  while ((match = lineRegex.exec(code)) !== null) {
    const type = match[1] as SegmentType
    const p1Parts = match[2].split(',').map((v) => Number(v.trim()))
    const p2Parts = match[3].split(',').map((v) => Number(v.trim()))
    const colorToken = match[4].trim()

    let colorParts: number[] | null = null
    if (colorToken.startsWith('(') && colorToken.endsWith(')')) {
      colorParts = colorToken
        .slice(1, -1)
        .split(',')
        .map((v) => Number(v.trim()))
    } else if (colorConstants.has(colorToken)) {
      colorParts = [...(colorConstants.get(colorToken) as [number, number, number])]
    }

    if (p1Parts.length !== 3 || p2Parts.length !== 3 || !colorParts || colorParts.length !== 3) {
      warnings.push(`Línea ${index}: formato inválido en coordenadas o color`)
      index += 1
      continue
    }

    if ([...p1Parts, ...p2Parts, ...colorParts].some((n) => Number.isNaN(n))) {
      warnings.push(`Línea ${index}: hay valores no numéricos`)
      index += 1
      continue
    }

    const [r, g, b] = colorParts
    const safe = [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))))

    segments.push({
      id: index,
      type,
      p1: { x: p1Parts[0], y: p1Parts[1], z: p1Parts[2] },
      p2: { x: p2Parts[0], y: p2Parts[1], z: p2Parts[2] },
      color: `rgb(${safe[0]}, ${safe[1]}, ${safe[2]})`,
    })
    index += 1
  }

  if (!segments.length) {
    warnings.push('No se encontraron llamadas a engine.palo/soga/cana')
  }

  return { segments, warnings }
}

function projectPoint(p: Vec3): { x: number; y: number } {
  return { x: p.x + p.y * 0.45, y: -p.z + p.y * 0.2 }
}

function rotatePoint3D(p: Vec3, center: Vec3, rotXDeg: number, rotZDeg: number): Vec3 {
  const rx = (rotXDeg * Math.PI) / 180
  const rz = (rotZDeg * Math.PI) / 180

  const px = p.x - center.x
  const py = p.y - center.y
  const pz = p.z - center.z

  const xz = px * Math.cos(rz) - py * Math.sin(rz)
  const yz = px * Math.sin(rz) + py * Math.cos(rz)
  const zz = pz

  const xx = xz
  const yx = yz * Math.cos(rx) - zz * Math.sin(rx)
  const zx = yz * Math.sin(rx) + zz * Math.cos(rx)

  return { x: xx + center.x, y: yx + center.y, z: zx + center.z }
}

function App() {
  const [code, setCode] = useState(starterCode)
  const [viewRotX, setViewRotX] = useState(18)
  const [viewRotZ, setViewRotZ] = useState(-35)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)

  const parsed = useMemo(() => parseSegments(code), [code])

  const drawing = useMemo(() => {
    const points3D = parsed.segments.flatMap((s) => [s.p1, s.p2])
    const center = points3D.length
      ? {
          x: points3D.reduce((acc, p) => acc + p.x, 0) / points3D.length,
          y: points3D.reduce((acc, p) => acc + p.y, 0) / points3D.length,
          z: points3D.reduce((acc, p) => acc + p.z, 0) / points3D.length,
        }
      : { x: 0, y: 0, z: 0 }

    const projected = parsed.segments.map((s) => {
      const p1r = rotatePoint3D(s.p1, center, viewRotX, viewRotZ)
      const p2r = rotatePoint3D(s.p2, center, viewRotX, viewRotZ)
      return {
        ...s,
        a: projectPoint(p1r),
        b: projectPoint(p2r),
      }
    })

    const pts = projected.flatMap((s) => [s.a, s.b])
    const base = pts.length ? pts : [{ x: 0, y: 0 }]
    const minX = Math.min(...base.map((p) => p.x))
    const maxX = Math.max(...base.map((p) => p.x))
    const minY = Math.min(...base.map((p) => p.y))
    const maxY = Math.max(...base.map((p) => p.y))

    const width = 840
    const height = 560
    const margin = 28
    const sx = (width - margin * 2) / Math.max(maxX - minX, 0.001)
    const sy = (height - margin * 2) / Math.max(maxY - minY, 0.001)
    const scale = Math.min(sx, sy)

    const map = (p: { x: number; y: number }) => ({
      x: margin + (p.x - minX) * scale,
      y: margin + (p.y - minY) * scale,
    })

    return {
      width,
      height,
      lines: projected.map((s) => ({ ...s, as: map(s.a), bs: map(s.b) })),
    }
  }, [parsed.segments, viewRotX, viewRotZ])

  const [promptCopied, setPromptCopied] = useState(false)

  async function copyPrompt() {
    await navigator.clipboard.writeText(geminiPrompt)
    setPromptCopied(true)
    setTimeout(() => setPromptCopied(false), 1500)
  }

  function handleCanvasMouseDown(e: MouseEvent<SVGSVGElement>) {
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  function handleCanvasMouseMove(e: MouseEvent<SVGSVGElement>) {
    if (!dragStart) return
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y

    setViewRotZ((prev) => prev + dx * 0.35)
    setViewRotX((prev) => Math.max(-89, Math.min(89, prev + dy * 0.25)))
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  function resetView() {
    setViewRotX(18)
    setViewRotZ(-35)
  }

  return (
    <>
    <div className="layout">
      <section className="previewPanel">
        <header className="panelHeader">
          <h2>Preview de construcción</h2>
          <div className="viewControls">
            <span>{parsed.segments.length} elementos</span>
            <span>Rot X {Math.round(viewRotX)}° / Z {Math.round(viewRotZ)}°</span>
            <button onClick={resetView}>Reset vista</button>
          </div>
        </header>

        <svg
          className={`previewCanvas ${dragStart ? 'dragging' : ''}`}
          viewBox={`0 0 ${drawing.width} ${drawing.height}`}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={() => setDragStart(null)}
          onMouseLeave={() => setDragStart(null)}
        >
          <rect x={0} y={0} width={drawing.width} height={drawing.height} fill="#f5f5f5" />
          {drawing.lines.map((line) => (
            <line
              key={line.id}
              x1={line.as.x}
              y1={line.as.y}
              x2={line.bs.x}
              y2={line.bs.y}
              stroke={line.color}
              strokeWidth={line.type === 'tabla' ? 9 : line.type === 'cana' ? 4 : line.type === 'soga' ? 2 : 3}
              strokeDasharray={line.type === 'soga' ? '6 4' : undefined}
              strokeLinecap="round"
            />
          ))}
        </svg>

        {parsed.warnings.length > 0 && (
          <div className="warnings">
            {parsed.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}
      </section>

      <section className="editorPanel">
        <header className="panelHeader">
          <h2>Código Python (estilo main.py)</h2>
          <button onClick={() => setCode(starterCode)}>Restaurar base</button>
        </header>

        <textarea
          className="codeBox"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />

        <div className="promptBox">
          <div className="promptHeader">
            <h3>Prompt para Gemini (imagen → código)</h3>
            <button onClick={copyPrompt}>{promptCopied ? 'Copiado' : 'Copiar prompt'}</button>
          </div>
          <textarea className="promptText" readOnly value={geminiPrompt} />
        </div>
      </section>
    </div>
      <GeminiChatModal 
        geminiPrompt={geminiPrompt} 
        onCodeGenerated={handleGeminiCodeGenerated}
      />
    </>
  )
}

export default App */
