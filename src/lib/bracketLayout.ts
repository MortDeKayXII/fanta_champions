/**
 * Where each tie sits in the bracket drawing. The order inside a round is the vertical order, top
 * to bottom, so that a tie of the next round sits between the two that feed it:
 *   playoff[i] -> r16[i];  r16[2i], r16[2i+1] -> quarter[i];  quarter[0], quarter[1] -> semi
 * The two halves meet in the final (SF-1 on the left, SF-2 on the right).
 */
export interface HalfLayout {
  playoff: string[]
  r16: string[]
  quarter: string[]
  semi: string
}

export const LEFT_HALF: HalfLayout = {
  playoff: ['PO-16-17', 'PO-9-24', 'PO-13-20', 'PO-12-21'],
  r16: ['R16-1', 'R16-8', 'R16-4', 'R16-5'],
  quarter: ['QF-1', 'QF-2'],
  semi: 'SF-1',
}

export const RIGHT_HALF: HalfLayout = {
  playoff: ['PO-14-19', 'PO-11-22', 'PO-15-18', 'PO-10-23'],
  r16: ['R16-3', 'R16-6', 'R16-2', 'R16-7'],
  quarter: ['QF-3', 'QF-4'],
  semi: 'SF-2',
}

export const FINAL_ID = 'F'
