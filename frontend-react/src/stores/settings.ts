import { create } from 'zustand'

/**
 * Minimal slice for Task 7 (chat needs `chatProvider()` + dialog open state).
 * Task 9 fills in `load` / `save` / `removeProvider` against `/api/me/llm-settings`.
 */
type SettingsState = {
  activeProvider: string | null
  settingsOpen: boolean
  openSettings: () => void
  closeSettings: () => void
  chatProvider: () => string | null
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  activeProvider: null,
  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  /** Value to send on chat requests (`null` means backend default / active_provider). */
  chatProvider: () => get().activeProvider,
}))
