import { describe, expect, it } from 'vitest'
import { buildBracket, type Entrant } from '../engine'
import { FINAL_ID, LEFT_HALF, RIGHT_HALF, type HalfLayout } from './bracketLayout'

const ranking = Array.from({ length: 30 }, (_, i) => `T${i + 1}`)
const ties = new Map(buildBracket(ranking).map((t) => [t.id, t]))
const winnerOf = (e: Entrant) => ('winnerOf' in e ? e.winnerOf : undefined)
const feeders = (id: string) => {
  const t = ties.get(id)!
  return [winnerOf(t.a), winnerOf(t.b)]
}

describe('bracket drawing layout', () => {
  it('uses every tie of the bracket exactly once', () => {
    const used = [LEFT_HALF, RIGHT_HALF].flatMap((h) => [
      ...h.playoff,
      ...h.r16,
      ...h.quarter,
      h.semi,
    ])
    expect([...used, FINAL_ID].sort()).toEqual([...ties.keys()].sort())
  })

  for (const [name, half] of [
    ['left', LEFT_HALF],
    ['right', RIGHT_HALF],
  ] as Array<[string, HalfLayout]>) {
    describe(`${name} half`, () => {
      it('each round-of-16 tie is fed by the playoff tie drawn beside it', () => {
        half.r16.forEach((id, i) => {
          expect(feeders(id)).toContain(half.playoff[i])
        })
      })

      it('each quarter-final sits between the two round-of-16 ties that feed it', () => {
        half.quarter.forEach((id, i) => {
          expect(feeders(id)).toEqual([half.r16[2 * i], half.r16[2 * i + 1]])
        })
      })

      it('the semi-final sits between its two quarter-finals', () => {
        expect(feeders(half.semi)).toEqual(half.quarter)
      })
    })
  }

  it('the final is between the two semi-finals, one from each half', () => {
    expect(feeders(FINAL_ID)).toEqual([LEFT_HALF.semi, RIGHT_HALF.semi])
  })

  it('seeds 1 and 2 are in opposite halves', () => {
    const seedTeam = (half: HalfLayout) =>
      half.r16.flatMap((id) => {
        const t = ties.get(id)!
        return [t.a, t.b].flatMap((e) => ('team' in e ? [e.team] : []))
      })
    expect(seedTeam(LEFT_HALF)).toContain('T1')
    expect(seedTeam(RIGHT_HALF)).toContain('T2')
    expect(seedTeam(LEFT_HALF)).not.toContain('T2')
  })
})
