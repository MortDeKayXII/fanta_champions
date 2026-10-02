// One-off import: joins the league roster exports with the full player list
// (Nome is the key) and writes data/rosters.json + a report of unmatched names.
// Usage: node scripts/join_rosters.mjs   (needs `unzip` on PATH)
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DIR = 'new_version_settings'
const decode = (s) =>
  s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

// Minimal xlsx reader: returns rows (arrays of strings) of the given sheet file.
function readSheet(xlsx, sheetFile = 'sheet1.xml') {
  const tmp = mkdtempSync(join(tmpdir(), 'xlsx-'))
  execFileSync('unzip', ['-o', '-q', xlsx, '-d', tmp])
  let shared = []
  try {
    shared = [...readFileSync(join(tmp, 'xl/sharedStrings.xml'), 'utf8').matchAll(/<si>(.*?)<\/si>/gs)].map((m) =>
      decode([...m[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((t) => t[1]).join('')),
    )
  } catch {}
  const xml = readFileSync(join(tmp, 'xl/worksheets', sheetFile), 'utf8')
  const colIdx = (ref) => [...ref.replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
  return [...xml.matchAll(/<row [^>]*>(.*?)<\/row>/gs)].map((r) => {
    const row = []
    for (const c of r[1].matchAll(/<c ([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
      const ref = c[1].match(/r="([A-Z]+)\d+"/)[1]
      const v = (c[2] || '').match(/<v>(.*?)<\/v>/)
      const inl = (c[2] || '').match(/<t[^>]*>(.*?)<\/t>/)
      row[colIdx(ref)] = v ? (/t="s"/.test(c[1]) ? shared[+v[1]] : decode(v[1])) : inl ? decode(inl[1]) : ''
    }
    return row
  })
}

const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase()

// Player list: header is the row starting with "Id"
const all = readSheet(join(DIR, 'full_list_player.xlsx'))
const h = all.findIndex((r) => r[0] === 'Id')
const players = new Map()
const dupes = []
for (const r of all.slice(h + 1)) {
  if (!r[3]) continue
  const p = { id: +r[0], role: r[1], mantraRoles: r[2], name: r[3], team: r[4] }
  if (players.has(norm(p.name))) dupes.push(p.name)
  players.set(norm(p.name), p)
}

const leagues = { montelparo: 'A', pepe: 'B', ortezzano: 'C' }
const teams = []
const unmatched = []
for (const f of readdirSync(DIR).filter((f) => f.startsWith('fanta-') && f.includes('-rosters-'))) {
  const league = leagues[f.split('-')[1]]
  const rows = readSheet(join(DIR, f))
  const header = rows[0]
  for (let c = 0; c < header.length; c += 3) {
    if (!header[c]) continue
    const roster = []
    for (const r of rows.slice(1)) {
      const name = r[c]
      if (!name || name === "totale") continue
      const p = players.get(norm(name))
      if (!p) unmatched.push({ team: header[c], name })
      roster.push({ name, cost: +r[c + 1] || 0, playerId: p?.id ?? null })
    }
    teams.push({ name: header[c].replace(/’/g, "'"), league, roster })
  }
}

writeFileSync('data/rosters.json', JSON.stringify({ players: [...players.values()], teams }, null, 1))
console.log('teams:', teams.length, teams.map((t) => `${t.name} [${t.league}] ${t.roster.length}`).join('\n  '))
console.log('players in list:', players.size, 'duplicate names:', dupes)
console.log('unmatched:', unmatched)
