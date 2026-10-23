import { describe, it, expect } from 'vitest'
import { pendingSteps, daysSince } from '@/utils/email/sequences/engine'
import type { SequenceStep } from '@/utils/email/sequences/types'

const paso = (step: number, delayDays: number): SequenceStep => ({ step, delayDays, content: () => null })
const PASOS = [paso(1, 0), paso(2, 2), paso(3, 4), paso(4, 7), paso(5, 10), paso(6, 14)]
const n = (s: SequenceStep[]) => s.map((x) => x.step)

describe('daysSince', () => {
  it('cuenta días completos desde el alta', () => {
    const alta = new Date('2026-10-01T10:00:00Z')
    expect(daysSince(alta, new Date('2026-10-01T23:00:00Z'))).toBe(0)
    expect(daysSince(alta, new Date('2026-10-03T10:00:00Z'))).toBe(2)
    expect(daysSince(alta, new Date('2026-10-03T09:59:00Z'))).toBe(1)
  })
})

describe('pendingSteps', () => {
  // El paso 1 lo manda el formulario en el acto; el cron empieza en el 2.
  it('no adelanta un paso antes de su día', () => {
    expect(n(pendingSteps(PASOS, new Set(), 1, 2))).toEqual([])
    expect(n(pendingSteps(PASOS, new Set(), 2, 2))).toEqual([2])
  })

  it('nunca repite un paso ya enviado', () => {
    expect(n(pendingSteps(PASOS, new Set([2]), 5, 2))).toEqual([3])
  })

  it('si el cron estuvo parado, ofrece los atrasados en orden', () => {
    expect(n(pendingSteps(PASOS, new Set([2, 3]), 11, 2))).toEqual([4, 5])
  })

  // Si el paso 4 se saltó (sin testimonio real) y luego aparece, no se manda
  // a quien ya recibió el 5: llegaría fuera de orden.
  it('no vuelve atrás a un paso que se saltó', () => {
    expect(n(pendingSteps(PASOS, new Set([2, 3, 5]), 20, 2))).toEqual([6])
  })

  it('con todo enviado no queda nada', () => {
    expect(n(pendingSteps(PASOS, new Set([2, 3, 4, 5, 6]), 30, 2))).toEqual([])
  })
})
