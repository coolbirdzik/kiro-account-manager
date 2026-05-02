import { create } from 'zustand'

export interface RegisterAccount {
  id: string
  email: string
  password: string
  refreshToken: string
  clientId: string
  status: 'pending' | 'activating' | 'registering' | 'getting_code' | 'success' | 'failed' | 'exists'
  awsName?: string
  ssoToken?: string
  error?: string
}

interface AutoRegisterState {
  // List of registration accounts
  accounts: RegisterAccount[]
  // Whether registration is running
  isRunning: boolean
  // Logs
  logs: string[]
  // Concurrency level
  concurrency: number
  // Skip Outlook activation
  skipOutlookActivation: boolean
  // Keep Outlook browser open after registration so mail can be checked manually
  keepOutlookBrowserOpen: boolean
  // Browser engine to use for automation
  browserEngine: 'chromium' | 'cloakbrowser'
  // Multi-proxy list (one URL per entry). When non-empty, rotates round-robin per task.
  proxyList: string[]
  // Internal round-robin cursor (incremented atomically per task)
  proxyIndex: number
  // Stop flag
  shouldStop: boolean
}

interface AutoRegisterActions {
  // Add accounts
  addAccounts: (accounts: RegisterAccount[]) => void
  // Clear all accounts
  clearAccounts: () => void
  // Update account status
  updateAccountStatus: (id: string, updates: Partial<RegisterAccount>) => void
  // Add log message
  addLog: (message: string) => void
  // Clear all logs
  clearLogs: () => void
  // Set running status
  setIsRunning: (running: boolean) => void
  // Set concurrency level
  setConcurrency: (concurrency: number) => void
  // Set skip Outlook activation
  setSkipOutlookActivation: (skip: boolean) => void
  // Set keep Outlook browser open
  setKeepOutlookBrowserOpen: (keep: boolean) => void
  // Set browser engine
  setBrowserEngine: (engine: 'chromium' | 'cloakbrowser') => void
  // Set proxy list (parses raw text: one proxy URL per line, blank lines ignored)
  setProxyList: (rawText: string) => void
  // Get next proxy URL using round-robin; returns undefined when list is empty
  getNextProxy: () => string | undefined
  // Request stop
  requestStop: () => void
  // Reset stop flag
  resetStop: () => void
  // Get statistics
  getStats: () => {
    total: number
    pending: number
    running: number
    success: number
    failed: number
    exists: number
  }
}

type AutoRegisterStore = AutoRegisterState & AutoRegisterActions

export const useAutoRegisterStore = create<AutoRegisterStore>()((set, get) => ({
  // Initial state
  accounts: [],
  isRunning: false,
  logs: [],
  concurrency: 3,
  skipOutlookActivation: false,
  keepOutlookBrowserOpen: true,
  browserEngine: 'chromium',
  proxyList: [],
  proxyIndex: 0,
  shouldStop: false,

  // Add accounts
  addAccounts: (newAccounts) => {
    set((state) => ({
      accounts: [...state.accounts, ...newAccounts]
    }))
  },

  // Clear all accounts
  clearAccounts: () => {
    if (get().isRunning) return
    set({ accounts: [], logs: [] })
  },

  // Update account status
  updateAccountStatus: (id, updates) => {
    set((state) => ({
      accounts: state.accounts.map(acc =>
        acc.id === id ? { ...acc, ...updates } : acc
      )
    }))
  },

  // Add log message
  addLog: (message) => {
    const timestamp = new Date().toLocaleTimeString()
    set((state) => ({
      logs: [...state.logs, `[${timestamp}] ${message}`]
    }))
  },

  // Clear all logs
  clearLogs: () => {
    set({ logs: [] })
  },

  // Set running status
  setIsRunning: (running) => {
    set({ isRunning: running })
  },

  // Set concurrency level
  setConcurrency: (concurrency) => {
    set({ concurrency: Math.min(10, Math.max(1, concurrency)) })
  },

  // Set skip Outlook activation
  setSkipOutlookActivation: (skip) => {
    set({ skipOutlookActivation: skip })
  },

  // Set keep Outlook browser open
  setKeepOutlookBrowserOpen: (keep) => {
    set({ keepOutlookBrowserOpen: keep })
  },

  // Set browser engine
  setBrowserEngine: (engine) => {
    set({ browserEngine: engine })
  },

  // Parse and store proxy list
  setProxyList: (rawText) => {
    const list = rawText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
    set({ proxyList: list, proxyIndex: 0 })
  },

  // Round-robin next proxy
  getNextProxy: () => {
    const { proxyList, proxyIndex } = get()
    if (proxyList.length === 0) return undefined
    const proxy = proxyList[proxyIndex % proxyList.length]
    set({ proxyIndex: proxyIndex + 1 })
    return proxy
  },

  // Request stop
  requestStop: () => {
    set({ shouldStop: true })
  },

  // Reset stop flag
  resetStop: () => {
    set({ shouldStop: false })
  },

  // Get statistics
  getStats: () => {
    const accounts = get().accounts
    return {
      total: accounts.length,
      pending: accounts.filter(a => a.status === 'pending').length,
      running: accounts.filter(a => a.status === 'registering' || a.status === 'activating').length,
      success: accounts.filter(a => a.status === 'success').length,
      failed: accounts.filter(a => a.status === 'failed').length,
      exists: accounts.filter(a => a.status === 'exists').length
    }
  }
}))
