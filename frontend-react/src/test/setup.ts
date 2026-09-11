import '@testing-library/jest-dom/vitest'

// jsdom has no ResizeObserver; ECharts-backed components (ChartView) observe their
// container for resizing, so stub a no-op implementation for tests.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}
