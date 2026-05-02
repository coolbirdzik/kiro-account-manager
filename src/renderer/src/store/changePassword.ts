import { create } from 'zustand'

export interface ChangePasswordAccount {
  id: string
  email: string
  oldPassword: string
  refreshToken: string
  clientId: string
  status: 'pending' | 'running' | 'success' | 'failed'
  newPassword?: string
  error?: string
}

interface ChangePasswordState {
  accounts: ChangePasswordAccount[]
  isRunning: boolean
  logs: string[]
  concurrency: number
  shouldStop: boolean
  globalNewPassword: string
}

interface ChangePasswordActions {
  addAccounts: (accounts: ChangePasswordAccount[]) => void
  clearAccounts: () => void
  updateAccountStatus: (id: string, updates: Partial<ChangePasswordAccount>) => void
  addLog: (message: string) => void
  clearLogs: () => void
  setIsRunning: (running: boolean) => void
  setConcurrency: (concurrency: number) => void
  setGlobalNewPassword: (password: string) => void
  requestStop: () => void
  resetStop: () => void
  getStats: () => {
    total: number
    pending: number
    running: number
    success: number
    failed: number
  }
}

type ChangePasswordStore = ChangePasswordState & ChangePasswordActions

export const useChangePasswordStore = create<ChangePasswordStore>()((set, get) => ({
  accounts: [],
  isRunning: false,
  logs: [],
  concurrency: 3,
  shouldStop: false,
  globalNewPassword: '',

  addAccounts: (newAccounts) => {
    set((state) => ({ accounts: [...state.accounts, ...newAccounts] }))
  },

  clearAccounts: () => {
    if (get().isRunning) return
    set({ accounts: [], logs: [] })
  },

  updateAccountStatus: (id, updates) => {
    set((state) => ({
      accounts: state.accounts.map((acc) => (acc.id === id ? { ...acc, ...updates } : acc))
    }))
  },

  addLog: (message) => {
    const timestamp = new Date().toLocaleTimeString()
    set((state) => ({
      logs: [...state.logs, `[${timestamp}] ${message}`]
    }))
  },

  clearLogs: () => {
    set({ logs: [] })
  },

  setIsRunning: (running) => {
    set({ isRunning: running })
  },

  setConcurrency: (concurrency) => {
    set({ concurrency: Math.min(10, Math.max(1, concurrency)) })
  },

  setGlobalNewPassword: (password) => {
    set({ globalNewPassword: password })
  },

  requestStop: () => {
    set({ shouldStop: true })
  },

  resetStop: () => {
    set({ shouldStop: false })
  },

  getStats: () => {
    const accounts = get().accounts
    return {
      total: accounts.length,
      pending: accounts.filter((a) => a.status === 'pending').length,
      running: accounts.filter((a) => a.status === 'running').length,
      success: accounts.filter((a) => a.status === 'success').length,
      failed: accounts.filter((a) => a.status === 'failed').length
    }
  }
}))
