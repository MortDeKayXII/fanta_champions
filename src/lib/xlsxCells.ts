import { strFromU8, unzipSync } from 'fflate'

/** A spreadsheet cell: its value and whether the text is drawn in a light grey font. */
export interface GridCell {
  v: string | number | null
  grey: boolean
}

export type Grid = GridCell[][]

const EMPTY: GridCell = { v: null, grey: false }
export const cellAt = (grid: Grid, row: number, col: number): GridCell => grid[row]?.[col] ?? EMPTY

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')

const textOf = (xml: string): string =>
  decode([...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''))

const columnIndex = (letters: string) =>
  [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1

/** Light, unsaturated colours (e.g. A0A7B1) are what the export uses for "not counted". */
export function isGreyColor(rgb: string | undefined): boolean {
  if (!rgb) return false
  const hex = rgb.slice(-6)
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return Math.min(r, g, b) >= 0x90 && Math.max(r, g, b) - Math.min(r, g, b) <= 0x30
}

/**
 * Reads the first worksheet of an .xlsx, keeping the font colour of every cell (the official
 * reader libraries do not expose styles). Handles inline and shared strings.
 */
export function readGrid(bytes: Uint8Array): Grid {
  const files = unzipSync(bytes)
  const read = (path: string) => (files[path] ? strFromU8(files[path]) : undefined)

  const sheetPath =
    Object.keys(files)
      .filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/.test(p))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0] ?? ''
  const sheet = read(sheetPath)
  if (!sheet) throw new Error('Foglio di lavoro non trovato nel file')

  const shared = [...(read('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(
    (m) => textOf(m[1]),
  )

  // style index -> is the font grey?
  const styles = read('xl/styles.xml') ?? ''
  const fontGrey = [
    ...(styles.match(/<fonts[^>]*>([\s\S]*?)<\/fonts>/)?.[1] ?? '').matchAll(
      /<font>([\s\S]*?)<\/font>/g,
    ),
  ].map((m) => isGreyColor(m[1].match(/<color rgb="([0-9A-Fa-f]+)"/)?.[1]))
  const styleGrey = [
    ...(styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? '').matchAll(
      /<xf ([^>]*?)(?:\/>|>)/g,
    ),
  ].map((m) => fontGrey[Number(m[1].match(/fontId="(\d+)"/)?.[1] ?? 0)] ?? false)

  const grid: Grid = []
  for (const row of sheet.matchAll(/<row r="(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const r = Number(row[1]) - 1
    grid[r] = []
    for (const c of (row[2] ?? '').matchAll(
      /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
    )) {
      const attrs = c[2]
      const inner = c[3] ?? ''
      const type = attrs.match(/ t="(\w+)"/)?.[1]
      const style = Number(attrs.match(/ s="(\d+)"/)?.[1] ?? 0)
      const raw = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1]

      let v: string | number | null = null
      if (type === 'inlineStr') v = textOf(inner)
      else if (type === 's' && raw !== undefined) v = shared[Number(raw)] ?? null
      else if (type === 'str' && raw !== undefined) v = decode(raw)
      else if (raw !== undefined) v = Number.isFinite(Number(raw)) ? Number(raw) : decode(raw)
      if (v === '') v = null
      grid[r][columnIndex(c[1])] = { v, grey: styleGrey[style] ?? false }
    }
  }
  // Fill holes so callers can index freely.
  for (let r = 0; r < grid.length; r++) {
    grid[r] ??= []
    for (let c = 0; c < grid[r].length; c++) grid[r][c] ??= EMPTY
  }
  return grid
}
