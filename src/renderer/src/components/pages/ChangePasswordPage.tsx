import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Play,
  Square,
  Upload,
  Trash2,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Mail,
  KeyRound,
  RefreshCw,
  AlertCircle,
  Terminal,
  Shuffle
} from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { useAccountsStore } from '@/store/accounts'
import { useChangePasswordStore, type ChangePasswordAccount } from '@/store/changePassword'
import { v4 as uuidv4 } from 'uuid'

function generateStrongPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const special = '!@#$%^&*'
  const all = upper + lower + digits + special

  const pick = (charset: string) => charset[Math.floor(Math.random() * charset.length)]

  // Guarantee at least 2 of each class (Microsoft requirement)
  const chars = [pick(upper), pick(upper), pick(lower), pick(lower), pick(digits), pick(digits), pick(special), pick(special)]

  // Fill remaining to reach 16 chars
  for (let i = chars.length; i < 16; i++) {
    chars.push(pick(all))
  }

  // Shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }

  return chars.join('')
}

export function ChangePasswordPage() {
  const { t } = useTranslation()
  const [inputText, setInputText] = useState('')
  const logEndRef = useRef<HTMLDivElement>(null)

  const {
    accounts,
    isRunning,
    logs,
    concurrency,
    globalNewPassword,
    addAccounts,
    clearAccounts,
    updateAccountStatus,
    addLog,
    clearLogs,
    setIsRunning,
    setConcurrency,
    setGlobalNewPassword,
    requestStop,
    resetStop,
    getStats
  } = useChangePasswordStore()

  const { proxyUrl, setProxy } = useAccountsStore()

  // Subscribe to live log events from main process
  useEffect(() => {
    const unsubscribe = window.api.onChangePasswordLog((data) => {
      addLog(`[${data.email.split('@')[0]}] ${data.message}`)
    })
    return () => unsubscribe()
  }, [addLog])

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const parseAccounts = useCallback(
    (text: string): ChangePasswordAccount[] => {
      const lines = text.trim().split('\n')
      const parsed: ChangePasswordAccount[] = []

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue

        const parts = trimmed.split('|')
        if (parts.length >= 1 && parts[0].includes('@')) {
          parsed.push({
            id: uuidv4(),
            email: parts[0].trim(),
            oldPassword: parts[1]?.trim() || '',
            refreshToken: parts[2]?.trim() || '',
            clientId: parts[3]?.trim() || '',
            status: 'pending'
          })
        }
      }

      return parsed
    },
    []
  )

  const handleImport = () => {
    const parsed = parseAccounts(inputText)
    if (parsed.length === 0) {
      alert(t('change_password.no_valid_emails'))
      return
    }
    addAccounts(parsed)
    setInputText('')
    addLog(`${t('change_password.imported')} ${parsed.length} ${t('change_password.email_accounts')}`)
  }

  const handleImportFile = async () => {
    try {
      const result = await window.api.openFile({
        filters: [{ name: t('change_password.text_files'), extensions: ['txt'] }]
      })

      if (result && 'content' in result) {
        const parsed = parseAccounts(result.content)
        if (parsed.length > 0) {
          addAccounts(parsed)
          addLog(`${t('change_password.imported_from_file')} ${parsed.length} ${t('change_password.email_accounts')}`)
        }
      }
    } catch (error) {
      addLog(`${t('change_password.import_file_failed')}: ${error}`)
    }
  }

  const handleClear = () => {
    if (isRunning) {
      alert(t('change_password.stop_first'))
      return
    }
    clearAccounts()
  }

  const handleGenerate = () => {
    setGlobalNewPassword(generateStrongPassword())
  }

  // Process a single account
  const changeSinglePassword = async (account: ChangePasswordAccount): Promise<void> => {
    if (useChangePasswordStore.getState().shouldStop) return
    if (account.status === 'success') return

    const newPwd = useChangePasswordStore.getState().globalNewPassword

    try {
      updateAccountStatus(account.id, { status: 'running' })
      addLog(`[${account.email}] ${t('change_password.starting_single')}...`)

      const result = await window.api.changeOutlookPassword({
        email: account.email,
        oldPassword: account.oldPassword,
        newPassword: newPwd,
        refreshToken: account.refreshToken,
        clientId: account.clientId,
        proxyUrl: proxyUrl || undefined
      })

      if (result.success) {
        updateAccountStatus(account.id, { status: 'success', newPassword: result.newPassword || newPwd })
        addLog(`[${account.email}] ✓ ${t('change_password.status_success')}`)
      } else {
        updateAccountStatus(account.id, { status: 'failed', error: result.error })
        addLog(`[${account.email}] ✗ ${t('change_password.status_failed')}: ${result.error}`)
      }
    } catch (error) {
      updateAccountStatus(account.id, { status: 'failed', error: String(error) })
      addLog(`[${account.email}] ✗ Error: ${error}`)
    }
  }

  const startChanging = async () => {
    if (!globalNewPassword) {
      alert(t('change_password.new_password_placeholder'))
      return
    }

    const pending = accounts.filter((a) => a.status === 'pending' || a.status === 'failed')

    if (pending.length === 0) {
      alert(t('change_password.no_pending_accounts'))
      return
    }

    setIsRunning(true)
    resetStop()
    addLog(
      `========== ${t('change_password.starting_batch')} (${t('change_password.concurrency')}: ${concurrency}) ==========`
    )
    addLog(`${t('change_password.pending')}: ${pending.length}`)

    const runConcurrent = async () => {
      const queue = [...pending]
      const running: Promise<void>[] = []

      while (queue.length > 0 || running.length > 0) {
        if (useChangePasswordStore.getState().shouldStop) {
          addLog(t('change_password.user_stopped'))
          break
        }

        while (queue.length > 0 && running.length < concurrency) {
          const account = queue.shift()!
          const task = changeSinglePassword(account).then(() => {
            const index = running.indexOf(task)
            if (index > -1) running.splice(index, 1)
          })
          running.push(task)
        }

        if (running.length > 0) {
          await Promise.race(running)
        }
      }
    }

    await runConcurrent()

    setIsRunning(false)
    const stats = getStats()
    addLog(
      `========== ${t('change_password.complete')}: ${t('change_password.success')} ${stats.success}, ${t('change_password.failed')} ${stats.failed} ==========`
    )
  }

  const stopChanging = () => {
    requestStop()
    addLog(t('change_password.stopping'))
  }

  const copyAllResults = () => {
    const successAccounts = accounts.filter((a) => a.status === 'success' && a.newPassword)
    const text = successAccounts.map((a) => `${a.email}|${a.newPassword}`).join('\n')
    navigator.clipboard.writeText(text)
    addLog(t('change_password.results_copied'))
  }

  const getStatusBadge = (status: ChangePasswordAccount['status']) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            {t('change_password.status_pending')}
          </Badge>
        )
      case 'running':
        return (
          <Badge variant="default">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            {t('change_password.status_running')}
          </Badge>
        )
      case 'success':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            {t('change_password.status_success')}
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            {t('change_password.status_failed')}
          </Badge>
        )
    }
  }

  const stats = getStats()
  const successWithPwd = accounts.filter((a) => a.status === 'success' && a.newPassword)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('change_password.title')}</h1>
          <p className="text-muted-foreground">{t('change_password.description')}</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            type="text"
            placeholder={t('auto_register.proxy_address')}
            value={proxyUrl}
            onChange={(e) => setProxy(true, e.target.value)}
            disabled={isRunning}
            className="px-3 py-1.5 border rounded-lg bg-background text-sm w-56"
          />
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">{t('change_password.concurrency')}:</span>
            <select
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              disabled={isRunning}
              className="px-2 py-1.5 border rounded-lg bg-background text-sm w-16"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          {isRunning ? (
            <Button variant="destructive" onClick={stopChanging}>
              <Square className="w-4 h-4 mr-2" />
              {t('change_password.stop')}
            </Button>
          ) : (
            <Button onClick={startChanging} disabled={accounts.length === 0 || !globalNewPassword}>
              <Play className="w-4 h-4 mr-2" />
              {t('change_password.start')}
            </Button>
          )}
        </div>
      </div>

      {/* New password row */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <KeyRound className="w-5 h-5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium whitespace-nowrap">{t('change_password.new_password_label')}</span>
            <input
              type="text"
              placeholder={t('change_password.new_password_placeholder')}
              value={globalNewPassword}
              onChange={(e) => setGlobalNewPassword(e.target.value)}
              disabled={isRunning}
              className="flex-1 px-3 py-1.5 border rounded-lg bg-background text-sm font-mono"
            />
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isRunning}>
              <Shuffle className="w-4 h-4 mr-2" />
              {t('change_password.generate_btn')}
            </Button>
            {globalNewPassword && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigator.clipboard.writeText(globalNewPassword)}
              >
                <Copy className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats row */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">{t('change_password.total')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
              <div className="text-sm text-muted-foreground">{t('change_password.pending')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-500">{stats.running}</div>
              <div className="text-sm text-muted-foreground">{t('change_password.running')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-500">{stats.success}</div>
              <div className="text-sm text-muted-foreground">{t('change_password.success')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-500">{stats.failed}</div>
              <div className="text-sm text-muted-foreground">{t('change_password.failed')}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Input area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              {t('change_password.email_accounts')}
            </CardTitle>
            <CardDescription>{t('change_password.format_description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              className="w-full h-32 p-3 border rounded-lg bg-background resize-none font-mono text-sm"
              placeholder="example@outlook.com|OldPassword|M.C509_xxx...|9e5f94bc-xxx..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isRunning}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleImport} disabled={isRunning || !inputText}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {t('change_password.parse_add')}
              </Button>
              <Button variant="outline" onClick={handleImportFile} disabled={isRunning}>
                <Upload className="w-4 h-4 mr-2" />
                {t('change_password.import_from_file')}
              </Button>
              <Button variant="outline" onClick={handleClear} disabled={isRunning}>
                <Trash2 className="w-4 h-4 mr-2" />
                {t('change_password.clear')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Right: Logs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              {t('change_password.logs')}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={clearLogs}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-48 overflow-auto bg-black/90 rounded-lg p-3 font-mono text-xs space-y-0.5">
              {logs.length === 0 ? (
                <div className="text-gray-500">{t('change_password.no_logs')}</div>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    className={
                      log.includes('✓')
                        ? 'text-green-400'
                        : log.includes('✗') || log.includes('Error') || log.includes('failed')
                          ? 'text-red-400'
                          : log.includes('=====')
                            ? 'text-yellow-400'
                            : log.includes('⚠')
                              ? 'text-orange-400'
                              : 'text-gray-300'
                    }
                  >
                    {log}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account list */}
      {accounts.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              {t('change_password.account_list')}
            </CardTitle>
            {successWithPwd.length > 0 && (
              <Button variant="outline" size="sm" onClick={copyAllResults}>
                <Copy className="w-4 h-4 mr-2" />
                {t('change_password.copy_all_results')} ({successWithPwd.length})
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium">#</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">{t('dialogs.email')}</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">{t('auto_register.status')}</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">{t('change_password.new_password_label').split('(')[0].trim()}</th>
                    <th className="px-4 py-2 text-left text-sm font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account, index) => (
                    <tr key={account.id} className="border-t">
                      <td className="px-4 py-2 text-sm">{index + 1}</td>
                      <td className="px-4 py-2 text-sm font-mono">{account.email}</td>
                      <td className="px-4 py-2">{getStatusBadge(account.status)}</td>
                      <td className="px-4 py-2 text-sm font-mono">
                        {account.status === 'success' && account.newPassword ? (
                          <span className="text-green-600 dark:text-green-400">{account.newPassword}</span>
                        ) : account.status === 'failed' ? (
                          <span className="text-red-500 text-xs">{account.error?.substring(0, 50)}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {account.status === 'success' && account.newPassword && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigator.clipboard.writeText(`${account.email}|${account.newPassword}`)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {t('change_password.instruction_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            1. {t('change_password.instruction_1')}{' '}
            <code className="bg-muted px-1 rounded">{t('change_password.format_example')}</code>
          </p>
          <p className="pl-4 text-xs">
            - {t('change_password.old_password_desc')}
            <br />
            - {t('change_password.refresh_token_desc')}
            <br />
            - {t('change_password.client_id_desc')}
          </p>
          <p>2. {t('change_password.instruction_2')}</p>
          <p>3. {t('change_password.instruction_3')}</p>
          <p>4. {t('change_password.instruction_4')}</p>
          <p className="text-yellow-500 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {t('change_password.instruction_warning')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
