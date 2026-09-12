import { describe, expect, it } from 'vitest'

import { canAskData, canManageLlm, VIEWER_READONLY_DETAIL } from './roles'

describe('roles', () => {
  it('allows admin and analyst to ask and manage LLM', () => {
    for (const role of ['admin', 'analyst'] as const) {
      expect(canAskData(role)).toBe(true)
      expect(canManageLlm(role)).toBe(true)
    }
  })

  it('blocks viewer (and missing role)', () => {
    expect(canAskData('viewer')).toBe(false)
    expect(canManageLlm('viewer')).toBe(false)
    expect(canAskData(null)).toBe(false)
    expect(canAskData(undefined)).toBe(false)
  })

  it('exports a stable viewer copy string', () => {
    expect(VIEWER_READONLY_DETAIL).toMatch(/viewer/)
  })
})
