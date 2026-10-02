import { describe, expect, it } from 'vitest'
import rosters from '../../data/rosters.json'
import { teamEmail, teamSlug } from './slug'

describe('teamSlug', () => {
  it('ignores case, accents, spaces and punctuation', () => {
    expect(teamSlug("SFC MANCO M'ANNAVA")).toBe('sfcmancomannava')
    expect(teamSlug('sfc manco m’annava')).toBe('sfcmancomannava')
    expect(teamSlug('  Fc   Increduli ')).toBe('fcincreduli')
    expect(teamSlug('Città È')).toBe('cittae')
  })

  it('builds the internal login email', () => {
    expect(teamEmail('bomberini')).toBe('bomberini@fanta.invalid')
  })

  it('gives all 30 teams a distinct, non-empty slug', () => {
    const slugs = rosters.teams.map((t) => teamSlug(t.name))
    expect(new Set(slugs).size).toBe(30)
    expect(slugs.every((s) => s.length > 0)).toBe(true)
  })
})
