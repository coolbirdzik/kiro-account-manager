import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'

export interface VaultEntry {
  id: string
  email: string
  password: string
  refreshToken: string
  clientId: string
  done: boolean
  note?: string
  tags?: string[]
  awsName?: string
  ssoToken?: string
  createdAt: number
  lastUsedAt?: number
}

interface VaultState {
  entries: VaultEntry[]
}

interface VaultActions {
  loadFromStorage: () => Promise<void>
  saveToStorage: () => Promise<void>
  addEntry: (entry: Omit<VaultEntry, 'id' | 'createdAt'>) => void
  updateEntry: (id: string, updates: Partial<VaultEntry>) => void
  deleteEntry: (id: string) => void
  deleteEntries: (ids: string[]) => void
  clearDone: () => void
  markDone: (id: string, done: boolean) => void
  upsertByEmail: (
    email: string,
    updates: Partial<Omit<VaultEntry, 'id' | 'email' | 'createdAt'>>
  ) => void
  importPipeText: (text: string) => { added: number; updated: number; skipped: number }
  exportPipeText: (ids?: string[]) => string
}

type VaultStore = VaultState & VaultActions

export const useVaultStore = create<VaultStore>()((set, get) => ({
  entries: [],

  loadFromStorage: async () => {
    try {
      const data = await window.api.loadVault()
      if (data && Array.isArray((data as { entries?: VaultEntry[] }).entries)) {
        set({ entries: (data as { entries: VaultEntry[] }).entries })
      }
    } catch (error) {
      console.error('[Vault] Failed to load from storage:', error)
    }
  },

  saveToStorage: async () => {
    try {
      await window.api.saveVault({ entries: get().entries })
    } catch (error) {
      console.error('[Vault] Failed to save to storage:', error)
    }
  },

  addEntry: (entry) => {
    const newEntry: VaultEntry = {
      ...entry,
      id: uuidv4(),
      createdAt: Date.now()
    }
    set((state) => ({ entries: [...state.entries, newEntry] }))
    get().saveToStorage()
  },

  updateEntry: (id, updates) => {
    set((state) => ({
      entries: state.entries.map((e) => (e.id === id ? { ...e, ...updates } : e))
    }))
    get().saveToStorage()
  },

  deleteEntry: (id) => {
    set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }))
    get().saveToStorage()
  },

  deleteEntries: (ids) => {
    const idSet = new Set(ids)
    set((state) => ({ entries: state.entries.filter((e) => !idSet.has(e.id)) }))
    get().saveToStorage()
  },

  clearDone: () => {
    set((state) => ({ entries: state.entries.filter((e) => !e.done) }))
    get().saveToStorage()
  },

  markDone: (id, done) => {
    set((state) => ({
      entries: state.entries.map((e) => (e.id === id ? { ...e, done } : e))
    }))
    get().saveToStorage()
  },

  upsertByEmail: (email, updates) => {
    const emailLower = email.toLowerCase()
    const existing = get().entries.find((e) => e.email.toLowerCase() === emailLower)
    if (existing) {
      set((state) => ({
        entries: state.entries.map((e) =>
          e.email.toLowerCase() === emailLower ? { ...e, ...updates } : e
        )
      }))
    } else {
      const newEntry: VaultEntry = {
        id: uuidv4(),
        email,
        password: (updates.password as string) || '',
        refreshToken: (updates.refreshToken as string) || '',
        clientId: (updates.clientId as string) || '',
        done: updates.done ?? false,
        note: updates.note,
        tags: updates.tags,
        awsName: updates.awsName,
        ssoToken: updates.ssoToken,
        createdAt: Date.now(),
        lastUsedAt: updates.lastUsedAt
      }
      set((state) => ({ entries: [...state.entries, newEntry] }))
    }
    get().saveToStorage()
  },

  importPipeText: (text) => {
    const lines = text.trim().split('\n')
    let added = 0
    let updated = 0
    let skipped = 0

    const currentEntries = get().entries
    const emailMap = new Map<string, VaultEntry>()
    for (const e of currentEntries) {
      emailMap.set(e.email.toLowerCase(), e)
    }

    const toAdd: VaultEntry[] = []
    const toUpdate: Array<{ id: string; updates: Partial<VaultEntry> }> = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        skipped++
        continue
      }
      const parts = trimmed.split('|')
      const email = parts[0]?.trim()
      if (!email || !email.includes('@')) {
        skipped++
        continue
      }
      const password = parts[1]?.trim() || ''
      const refreshToken = parts[2]?.trim() || ''
      const clientId = parts[3]?.trim() || ''
      const doneRaw = parts[4]?.trim() || ''
      const done = !!doneRaw && doneRaw !== '0' && doneRaw.toLowerCase() !== 'false'

      const existing = emailMap.get(email.toLowerCase())
      if (existing) {
        toUpdate.push({
          id: existing.id,
          updates: { password, refreshToken, clientId, done, lastUsedAt: Date.now() }
        })
        updated++
      } else {
        toAdd.push({
          id: uuidv4(),
          email,
          password,
          refreshToken,
          clientId,
          done,
          createdAt: Date.now()
        })
        added++
      }
    }

    set((state) => {
      const updatedEntries = state.entries.map((e) => {
        const upd = toUpdate.find((u) => u.id === e.id)
        return upd ? { ...e, ...upd.updates } : e
      })
      return { entries: [...updatedEntries, ...toAdd] }
    })

    if (added > 0 || updated > 0) {
      get().saveToStorage()
    }

    return { added, updated, skipped }
  },

  exportPipeText: (ids) => {
    const entries = ids
      ? get().entries.filter((e) => ids.includes(e.id))
      : get().entries
    return entries
      .map((e) => `${e.email}|${e.password}|${e.refreshToken}|${e.clientId}|${e.done ? '1' : ''}`)
      .join('\n')
  }
}))
