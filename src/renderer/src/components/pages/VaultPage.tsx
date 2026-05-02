import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Vault,
  Search,
  Plus,
  Upload,
  Download,
  Trash2,
  Copy,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Edit,
  Filter,
  Play,
  KeyRound,
  X,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { useVaultStore, type VaultEntry } from '@/store/vault'
import { useAutoRegisterStore, type RegisterAccount } from '@/store/autoRegister'
import { useChangePasswordStore, type ChangePasswordAccount } from '@/store/changePassword'
import { v4 as uuidv4 } from 'uuid'
import { cn } from '@/lib/utils'

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  entry: VaultEntry | null
  onClose: () => void
  onSave: (updates: Partial<VaultEntry>) => void
}

function EditModal({ entry, onClose, onSave }: EditModalProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<Partial<VaultEntry>>({
    email: entry?.email ?? '',
    password: entry?.password ?? '',
    refreshToken: entry?.refreshToken ?? '',
    clientId: entry?.clientId ?? '',
    done: entry?.done ?? false,
    note: entry?.note ?? '',
    tags: entry?.tags ?? [],
    awsName: entry?.awsName ?? '',
    ssoToken: entry?.ssoToken ?? ''
  })
  const [tagInput, setTagInput] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [showToken, setShowToken] = useState(false)

  const field = (key: keyof VaultEntry) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const addTag = () => {
    const tag = tagInput.trim()
    if (!tag) return
    const existing = form.tags ?? []
    if (!existing.includes(tag)) {
      setForm((prev) => ({ ...prev, tags: [...existing, tag] }))
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setForm((prev) => ({ ...prev, tags: (prev.tags ?? []).filter((t) => t !== tag) }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card border rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {entry ? t('vault.edit_entry') : t('vault.add_entry')}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">{t('vault.col_email')}</label>
            <input
              className="mt-1 w-full px-3 py-2 border rounded-lg bg-background text-sm font-mono"
              value={form.email as string}
              onChange={field('email')}
              placeholder="user@outlook.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('vault.col_password')}</label>
            <div className="relative mt-1">
              <input
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm font-mono pr-10"
                type={showPwd ? 'text' : 'password'}
                value={form.password as string}
                onChange={field('password')}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowPwd((v) => !v)}
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">{t('vault.col_refresh_token')}</label>
            <div className="relative mt-1">
              <input
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm font-mono pr-10"
                type={showToken ? 'text' : 'password'}
                value={form.refreshToken as string}
                onChange={field('refreshToken')}
                placeholder="M.C509_xxx..."
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowToken((v) => !v)}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">{t('vault.col_client_id')}</label>
            <input
              className="mt-1 w-full px-3 py-2 border rounded-lg bg-background text-sm font-mono"
              value={form.clientId as string}
              onChange={field('clientId')}
              placeholder="9e5f94bc-xxx..."
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="vault-done"
              checked={form.done as boolean}
              onChange={(e) => setForm((prev) => ({ ...prev, done: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="vault-done" className="text-sm font-medium">{t('vault.col_done')}</label>
          </div>
          <div>
            <label className="text-sm font-medium">{t('vault.col_aws_name')}</label>
            <input
              className="mt-1 w-full px-3 py-2 border rounded-lg bg-background text-sm"
              value={form.awsName as string}
              onChange={field('awsName')}
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('vault.col_note')}</label>
            <textarea
              className="mt-1 w-full px-3 py-2 border rounded-lg bg-background text-sm resize-none"
              rows={2}
              value={form.note as string}
              onChange={field('note')}
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('vault.col_tags')}</label>
            <div className="flex gap-1 flex-wrap mt-1 mb-1">
              {(form.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/15 rounded-full text-xs"
                >
                  {tag}
                  <button onClick={() => removeTag(tag)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-1.5 border rounded-lg bg-background text-sm"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder={t('vault.tag_placeholder')}
              />
              <Button size="sm" variant="outline" onClick={addTag}>{t('common.add')}</Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={() => onSave(form)}>{t('common.save')}</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Row reveal state helper ──────────────────────────────────────────────────

function useReveal() {
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const toggle = useCallback((key: string) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }, [])
  return { revealed, toggle }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function VaultPage() {
  const { t } = useTranslation()
  const {
    entries,
    addEntry,
    updateEntry,
    deleteEntry,
    deleteEntries,
    clearDone,
    markDone,
    importPipeText,
    exportPipeText
  } = useVaultStore()

  const autoRegisterStore = useAutoRegisterStore()
  const changePasswordStore = useChangePasswordStore()

  // ── Filters
  const [search, setSearch] = useState('')
  const [filterDone, setFilterDone] = useState<'all' | 'done' | 'pending'>('all')
  const [filterTag, setFilterTag] = useState<string>('')

  // ── Selection
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // ── Import pane
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')

  // ── Edit modal
  const [editEntry, setEditEntry] = useState<VaultEntry | null | undefined>(undefined)
  // undefined = closed, null = new entry, VaultEntry = editing

  // ── Reveal masks
  const { revealed: revealedPwd, toggle: togglePwd } = useReveal()
  const { revealed: revealedToken, toggle: toggleToken } = useReveal()

  // ── Clipboard feedback
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [pipeCopied, setPipeCopied] = useState(false)
  const [importResult, setImportResult] = useState<{ added: number; updated: number; skipped: number } | null>(null)

  // ── Filtered entries
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    entries.forEach((e) => e.tags?.forEach((t) => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [entries])

  const filtered = useMemo(() => {
    let list = entries
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (e) =>
          e.email.toLowerCase().includes(q) ||
          (e.awsName?.toLowerCase() ?? '').includes(q) ||
          (e.note?.toLowerCase() ?? '').includes(q) ||
          (e.tags ?? []).some((t) => t.toLowerCase().includes(q))
      )
    }
    if (filterDone === 'done') list = list.filter((e) => e.done)
    if (filterDone === 'pending') list = list.filter((e) => !e.done)
    if (filterTag) list = list.filter((e) => (e.tags ?? []).includes(filterTag))
    return list
  }, [entries, search, filterDone, filterTag])

  const allSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id))
  const someSelected = filtered.some((e) => selected.has(e.id))

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        filtered.forEach((e) => next.delete(e.id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        filtered.forEach((e) => next.add(e.id))
        return next
      })
    }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedEntries = useMemo(
    () => entries.filter((e) => selected.has(e.id)),
    [entries, selected]
  )

  // ── Handlers
  const handleImport = () => {
    const result = importPipeText(importText)
    setImportResult(result)
    setImportText('')
    setTimeout(() => setImportResult(null), 4000)
  }

  const handleImportFile = async () => {
    try {
      const result = await window.api.openFile({
        filters: [{ name: t('auto_register.text_files'), extensions: ['txt'] }]
      })
      if (result && 'content' in result) {
        const res = importPipeText(result.content)
        setImportResult(res)
        setTimeout(() => setImportResult(null), 4000)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleExport = (format: 'pipe' | 'csv' | 'markdown') => {
    const ids = someSelected ? Array.from(selected) : undefined
    const targetEntries = ids ? entries.filter((e) => ids.includes(e.id)) : entries

    let content = ''
    if (format === 'pipe') {
      content = exportPipeText(ids)
    } else if (format === 'csv') {
      const header = 'email,password,refreshToken,clientId,done,awsName,note'
      const rows = targetEntries.map(
        (e) =>
          `"${e.email}","${e.password}","${e.refreshToken}","${e.clientId}","${e.done ? '1' : ''}","${e.awsName ?? ''}","${(e.note ?? '').replace(/"/g, '""')}"`
      )
      content = [header, ...rows].join('\n')
    } else {
      const header = '| email | password | refreshToken | clientId | done | awsName | note |'
      const divider = '|---|---|---|---|---|---|---|'
      const rows = targetEntries.map(
        (e) =>
          `| ${e.email} | ${e.password} | ${e.refreshToken} | ${e.clientId} | ${e.done ? '1' : ''} | ${e.awsName ?? ''} | ${e.note ?? ''} |`
      )
      content = [header, divider, ...rows].join('\n')
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `vault-export.${format === 'csv' ? 'csv' : format === 'markdown' ? 'md' : 'txt'}`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleCopyPipe = () => {
    const text = exportPipeText(someSelected ? Array.from(selected) : undefined)
    navigator.clipboard.writeText(text)
    setPipeCopied(true)
    setTimeout(() => setPipeCopied(false), 2000)
  }

  const handleCopyField = (id: string, value: string) => {
    navigator.clipboard.writeText(value)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleSendToAutoRegister = () => {
    const targets = someSelected ? selectedEntries : filtered.filter((e) => !e.done)
    const accounts: RegisterAccount[] = targets.map((e) => ({
      id: uuidv4(),
      email: e.email,
      password: e.password,
      refreshToken: e.refreshToken,
      clientId: e.clientId,
      status: 'pending'
    }))
    autoRegisterStore.addAccounts(accounts)
    alert(t('vault.sent_to_auto_register', { count: accounts.length }))
  }

  const handleSendToChangePassword = () => {
    const targets = someSelected ? selectedEntries : filtered.filter((e) => !e.done)
    const accounts: ChangePasswordAccount[] = targets.map((e) => ({
      id: uuidv4(),
      email: e.email,
      oldPassword: e.password,
      refreshToken: e.refreshToken,
      clientId: e.clientId,
      status: 'pending'
    }))
    changePasswordStore.addAccounts(accounts)
    alert(t('vault.sent_to_change_password', { count: accounts.length }))
  }

  const handleDeleteSelected = () => {
    if (!window.confirm(t('vault.confirm_delete_selected', { count: selected.size }))) return
    deleteEntries(Array.from(selected))
    setSelected(new Set())
  }

  const handleSaveEdit = (updates: Partial<VaultEntry>) => {
    if (editEntry === null) {
      // new entry
      addEntry({
        email: (updates.email as string) || '',
        password: (updates.password as string) || '',
        refreshToken: (updates.refreshToken as string) || '',
        clientId: (updates.clientId as string) || '',
        done: (updates.done as boolean) ?? false,
        note: updates.note,
        tags: updates.tags,
        awsName: updates.awsName,
        ssoToken: updates.ssoToken
      })
    } else if (editEntry) {
      updateEntry(editEntry.id, updates)
    }
    setEditEntry(undefined)
  }

  const stats = useMemo(
    () => ({
      total: entries.length,
      done: entries.filter((e) => e.done).length,
      pending: entries.filter((e) => !e.done).length
    }),
    [entries]
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Vault className="w-6 h-6" />
            {t('vault.title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('vault.description')}</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Button variant="outline" size="sm" onClick={() => setShowImport((v) => !v)}>
            {showImport ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
            {t('vault.import')}
          </Button>
          <Button size="sm" onClick={() => setEditEntry(null)}>
            <Plus className="w-4 h-4 mr-1" />
            {t('vault.add_entry')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">{t('vault.stat_total')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-500">{stats.done}</div>
            <div className="text-sm text-muted-foreground">{t('vault.stat_done')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
            <div className="text-sm text-muted-foreground">{t('vault.stat_pending')}</div>
          </CardContent>
        </Card>
      </div>

      {/* Import pane */}
      {showImport && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4" />
              {t('vault.import_paste')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              className="w-full h-28 p-3 border rounded-lg bg-background resize-none font-mono text-sm"
              placeholder="email|password|refreshToken|clientId|done"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            {importResult && (
              <p className="text-sm text-green-600">
                {t('vault.import_result', {
                  added: importResult.added,
                  updated: importResult.updated,
                  skipped: importResult.skipped
                })}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleImport} disabled={!importText.trim()}>
                {t('vault.parse_add')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleImportFile}>
                <Upload className="w-4 h-4 mr-1" />
                {t('vault.import_file')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Toolbar: search + filters + actions */}
      <Card>
        <CardContent className="pt-4 pb-3 space-y-3">
          {/* Search + filter row */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                className="w-full pl-9 pr-3 py-2 border rounded-lg bg-background text-sm"
                placeholder={t('vault.search_placeholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-1">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                className="px-2 py-1.5 border rounded-lg bg-background text-sm"
                value={filterDone}
                onChange={(e) => setFilterDone(e.target.value as 'all' | 'done' | 'pending')}
              >
                <option value="all">{t('vault.filter_all')}</option>
                <option value="done">{t('vault.filter_done')}</option>
                <option value="pending">{t('vault.filter_pending')}</option>
              </select>
            </div>

            {allTags.length > 0 && (
              <select
                className="px-2 py-1.5 border rounded-lg bg-background text-sm"
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
              >
                <option value="">{t('vault.filter_all_tags')}</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            )}

            <span className="text-sm text-muted-foreground ml-auto">
              {filtered.length} / {entries.length}
            </span>
          </div>

          {/* Action row */}
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendToAutoRegister}
              disabled={filtered.length === 0}
              title={t('vault.send_to_auto_register_hint')}
            >
              <Play className="w-4 h-4 mr-1" />
              {t('vault.send_to_auto_register')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendToChangePassword}
              disabled={filtered.length === 0}
              title={t('vault.send_to_change_password_hint')}
            >
              <KeyRound className="w-4 h-4 mr-1" />
              {t('vault.send_to_change_password')}
            </Button>

            <div className="w-px h-5 bg-border mx-1" />

            <Button variant="outline" size="sm" onClick={handleCopyPipe}>
              {pipeCopied ? <CheckCircle className="w-4 h-4 mr-1 text-green-500" /> : <Copy className="w-4 h-4 mr-1" />}
              {pipeCopied ? t('auto_register.copied') : t('vault.copy_pipe')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
              <Download className="w-4 h-4 mr-1" />CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('markdown')}>
              <Download className="w-4 h-4 mr-1" />MD
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('pipe')}>
              <Download className="w-4 h-4 mr-1" />TXT
            </Button>

            <div className="w-px h-5 bg-border mx-1" />

            <Button
              variant="outline"
              size="sm"
              onClick={clearDone}
              disabled={stats.done === 0}
              className="text-orange-500 border-orange-500 hover:bg-orange-50"
            >
              <XCircle className="w-4 h-4 mr-1" />
              {t('vault.clear_done')}
            </Button>
            {someSelected && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {t('vault.delete_selected', { count: selected.size })}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {entries.length === 0 ? t('vault.empty_hint') : t('vault.no_results')}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left w-8">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-3 py-2 text-left font-medium">{t('vault.col_email')}</th>
                    <th className="px-3 py-2 text-left font-medium">{t('vault.col_password')}</th>
                    <th className="px-3 py-2 text-left font-medium">{t('vault.col_refresh_token')}</th>
                    <th className="px-3 py-2 text-left font-medium">{t('vault.col_client_id')}</th>
                    <th className="px-3 py-2 text-center font-medium">{t('vault.col_done')}</th>
                    <th className="px-3 py-2 text-left font-medium">{t('vault.col_aws_name')}</th>
                    <th className="px-3 py-2 text-left font-medium">{t('vault.col_tags')}</th>
                    <th className="px-3 py-2 text-left font-medium">{t('vault.col_note')}</th>
                    <th className="px-3 py-2 text-center font-medium">{t('common.edit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => {
                    const pwdKey = `pwd-${entry.id}`
                    const tokenKey = `tok-${entry.id}`
                    const isSelected = selected.has(entry.id)
                    return (
                      <tr
                        key={entry.id}
                        className={cn(
                          'border-t transition-colors',
                          isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                        )}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(entry.id)}
                            className="rounded"
                          />
                        </td>

                        {/* Email */}
                        <td className="px-3 py-2 font-mono max-w-[180px] truncate" title={entry.email}>
                          {entry.email}
                        </td>

                        {/* Password */}
                        <td className="px-3 py-2 font-mono">
                          <div className="flex items-center gap-1">
                            <span className="truncate max-w-[80px]">
                              {revealedPwd.has(pwdKey) ? entry.password : '••••••••'}
                            </span>
                            <button
                              onClick={() => togglePwd(pwdKey)}
                              className="text-muted-foreground hover:text-foreground shrink-0"
                            >
                              {revealedPwd.has(pwdKey) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                            {entry.password && (
                              <button
                                onClick={() => handleCopyField(`pwd-copy-${entry.id}`, entry.password)}
                                className="text-muted-foreground hover:text-foreground shrink-0"
                              >
                                {copiedId === `pwd-copy-${entry.id}` ? (
                                  <Check className="w-3 h-3 text-green-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Refresh Token */}
                        <td className="px-3 py-2 font-mono">
                          <div className="flex items-center gap-1">
                            <span className="truncate max-w-[80px] text-xs">
                              {revealedToken.has(tokenKey)
                                ? entry.refreshToken || '-'
                                : entry.refreshToken
                                ? '••••••••'
                                : '-'}
                            </span>
                            {entry.refreshToken && (
                              <>
                                <button
                                  onClick={() => toggleToken(tokenKey)}
                                  className="text-muted-foreground hover:text-foreground shrink-0"
                                >
                                  {revealedToken.has(tokenKey) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </button>
                                <button
                                  onClick={() => handleCopyField(`tok-copy-${entry.id}`, entry.refreshToken)}
                                  className="text-muted-foreground hover:text-foreground shrink-0"
                                >
                                  {copiedId === `tok-copy-${entry.id}` ? (
                                    <Check className="w-3 h-3 text-green-500" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Client ID */}
                        <td className="px-3 py-2 font-mono text-xs max-w-[80px] truncate" title={entry.clientId}>
                          {entry.clientId || '-'}
                        </td>

                        {/* Done toggle */}
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => markDone(entry.id, !entry.done)}
                            title={entry.done ? t('vault.mark_pending') : t('vault.mark_done')}
                          >
                            {entry.done ? (
                              <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="w-4 h-4 text-muted-foreground mx-auto" />
                            )}
                          </button>
                        </td>

                        {/* AWS Name */}
                        <td className="px-3 py-2 text-xs max-w-[80px] truncate" title={entry.awsName}>
                          {entry.awsName || '-'}
                        </td>

                        {/* Tags */}
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {(entry.tags ?? []).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs px-1 py-0">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </td>

                        {/* Note */}
                        <td className="px-3 py-2 text-xs max-w-[100px] truncate text-muted-foreground" title={entry.note}>
                          {entry.note || '-'}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setEditEntry(entry)}
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (window.confirm(t('vault.confirm_delete_one'))) {
                                  deleteEntry(entry.id)
                                  setSelected((prev) => {
                                    const next = new Set(prev)
                                    next.delete(entry.id)
                                    return next
                                  })
                                }
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit / Add modal */}
      {editEntry !== undefined && (
        <EditModal
          entry={editEntry}
          onClose={() => setEditEntry(undefined)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  )
}
