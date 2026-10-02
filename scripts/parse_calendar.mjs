// One-off import: parses new_version_settings/calendario.pdf into data/calendar.json.
// Usage: node scripts/parse_calendar.mjs   (needs `pdftotext` on PATH)
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const text = execFileSync('pdftotext', ['new_version_settings/calendario.pdf', '-'], { encoding: 'utf8' })
  .replace(/’/g, "'")
  .replace(/\s+/g, ' ')

const key = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const known = new Map(
  JSON.parse(readFileSync('data/rosters.json', 'utf8')).teams.map((t) => [key(t.name), t]),
)

const matchdays = {}
const problems = []
for (const part of text.split(/Giornata (\d+) /).slice(1).reduce((acc, v, i, a) => (i % 2 ? acc : [...acc, [v, a[i + 1]]]), [])) {
  const [n, body] = part
  const games = []
  for (const m of body.matchAll(/(.+?) \(([ABC])\) vs (.+?) \(([ABC])\)(?= |$)/g)) {
    const [home, away] = [m[1].trim(), m[3].trim()]
    for (const [name, league] of [[home, m[2]], [away, m[4]]]) {
      const t = known.get(key(name))
      if (!t) problems.push(`G${n}: unknown team "${name}"`)
      else if (t.league !== league) problems.push(`G${n}: ${name} league ${league} != ${t.league}`)
    }
    games.push({ home: known.get(key(home))?.name ?? home, away: known.get(key(away))?.name ?? away })
  }
  matchdays[n] = games
}

// Sanity: 8 matchdays x 15 games, each team plays once per matchday.
for (const [n, games] of Object.entries(matchdays)) {
  const seen = games.flatMap((g) => [g.home, g.away])
  if (games.length !== 15) problems.push(`G${n}: ${games.length} games`)
  if (new Set(seen).size !== 30) problems.push(`G${n}: ${new Set(seen).size} distinct teams`)
}
writeFileSync('data/calendar.json', JSON.stringify(matchdays, null, 1))
console.log(Object.keys(matchdays).length, 'matchdays;', problems.length ? problems : 'no problems')
