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
  Key,
  RefreshCw,
  AlertCircle,
  Terminal,
  Zap,
  Download
} from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { useAccountsStore } from '@/store/accounts'
import { useAutoRegisterStore, type RegisterAccount } from '@/store/autoRegister'
import { useVaultStore } from '@/store/vault'
import { v4 as uuidv4 } from 'uuid'

export function AutoRegisterPage() {
  const { t } = useTranslation()
  const [inputText, setInputText] = useState('')
  const [pipeCopied, setPipeCopied] = useState(false)
  const [showProxyPanel, setShowProxyPanel] = useState(false)
  const [proxyListText, setProxyListText] = useState('')
  const logEndRef = useRef<HTMLDivElement>(null)
  
  // 使用全局 store
  const {
    accounts,
    isRunning,
    logs,
    concurrency,
    skipOutlookActivation,
    keepOutlookBrowserOpen,
    browserEngine,
    proxyList,
    addAccounts,
    clearAccounts,
    updateAccountStatus,
    addLog,
    clearLogs,
    setIsRunning,
    setConcurrency,
    setSkipOutlookActivation,
    setKeepOutlookBrowserOpen,
    setBrowserEngine,
    setProxyList,
    getNextProxy,
    requestStop,
    resetStop,
    getStats
  } = useAutoRegisterStore()
  
  const { addAccount, saveToStorage, proxyUrl, setProxy, accounts: existingAccounts } = useAccountsStore()

  // 检查邮箱是否已存在
  const isEmailExists = useCallback((email: string): boolean => {
    const emailLower = email.toLowerCase()
    return Array.from(existingAccounts.values()).some(
      acc => acc.email.toLowerCase() === emailLower
    )
  }, [existingAccounts])

  // 监听来自主进程的实时日志
  useEffect(() => {
    const unsubscribe = window.api.onAutoRegisterLog((data) => {
      addLog(`[${data.email.split('@')[0]}] ${data.message}`)
    })
    return () => unsubscribe()
  }, [addLog])

  // 自动滚动到日志底部
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const parseAccounts = (text: string): RegisterAccount[] => {
    const lines = text.trim().split('\n')
    const parsed: RegisterAccount[] = []
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      
      const parts = trimmed.split('|')
      if (parts.length >= 1 && parts[0].includes('@')) {
        const email = parts[0].trim()
        const doneField = parts[4]?.trim() || ''
        // Skip if the "done" column is set, or if already in the manager
        const isDone = !!doneField && doneField !== '0' && doneField.toLowerCase() !== 'false'
        const exists = isDone || isEmailExists(email)
        parsed.push({
          id: uuidv4(),
          email,
          password: parts[1]?.trim() || '',
          refreshToken: parts[2]?.trim() || '',
          clientId: parts[3]?.trim() || '',
          status: exists ? 'exists' : 'pending'
        })
      }
    }
    
    return parsed
  }

  const handleImport = () => {
    const parsed = parseAccounts(inputText)
    if (parsed.length === 0) {
      alert(t('auto_register.no_valid_emails'))
      return
    }
    const existsCount = parsed.filter(a => a.status === 'exists').length
    addAccounts(parsed)
    setInputText('')
    addLog(`${t('auto_register.imported')} ${parsed.length} ${t('auto_register.email_accounts')}${existsCount > 0 ? `，${t('auto_register.of_which')} ${existsCount} ${t('auto_register.already_exist')}` : ''}`)
  }

  const handleImportFile = async () => {
    try {
      const result = await window.api.openFile({
        filters: [{ name: t('auto_register.text_files'), extensions: ['txt'] }]
      })
      
      if (result && 'content' in result) {
        const parsed = parseAccounts(result.content)
        if (parsed.length > 0) {
          const existsCount = parsed.filter(a => a.status === 'exists').length
          addAccounts(parsed)
          addLog(`${t('auto_register.imported_from_file')} ${parsed.length} ${t('auto_register.email_accounts')}${existsCount > 0 ? `，${t('auto_register.of_which')} ${existsCount} ${t('auto_register.already_exist')}` : ''}`)
        }
      }
    } catch (error) {
      addLog(`${t('auto_register.import_file_failed')}: ${error}`)
    }
  }

  const handleClear = () => {
    if (isRunning) {
      alert(t('auto_register.stop_first'))
      return
    }
    clearAccounts()
  }

  // Import account using SSO Token
  const importWithSsoToken = async (account: RegisterAccount, ssoToken: string, name: string) => {
    try {
      addLog(`[${account.email}] ${t('auto_register.importing_via_sso')}...`)
      
      const result = await window.api.importFromSsoToken(ssoToken, 'us-east-1')
      
      if (result.success && result.data) {
        const { data } = result
        
        // Determine idp type
        const idpValue = data.idp as 'Google' | 'Github' | 'BuilderId' | 'AWSIdC' | 'Internal' || 'BuilderId'
        
        // Determine subscription type
        let subscriptionType: 'Free' | 'Pro' | 'Pro_Plus' | 'Enterprise' | 'Teams' = 'Free'
        const subType = data.subscriptionType?.toUpperCase() || ''
        if (subType.includes('PRO_PLUS') || subType.includes('PRO+')) {
          subscriptionType = 'Pro_Plus'
        } else if (subType.includes('PRO')) {
          subscriptionType = 'Pro'
        } else if (subType.includes('ENTERPRISE')) {
          subscriptionType = 'Enterprise'
        } else if (subType.includes('TEAMS')) {
          subscriptionType = 'Teams'
        }
        
        addAccount({
          email: data.email || account.email,
          nickname: name,
          idp: idpValue,
          credentials: {
            accessToken: data.accessToken,
            csrfToken: '',
            refreshToken: data.refreshToken,
            clientId: data.clientId,
            clientSecret: data.clientSecret,
            region: data.region || 'us-east-1',
            authMethod: 'IdC',
            expiresAt: Date.now() + (data.expiresIn || 3600) * 1000
          },
          subscription: { 
            type: subscriptionType,
            title: data.subscriptionTitle
          },
          usage: data.usage ? {
            current: data.usage.current,
            limit: data.usage.limit,
            percentUsed: data.usage.limit > 0 ? (data.usage.current / data.usage.limit) * 100 : 0,
            lastUpdated: Date.now()
          } : { current: 0, limit: 50, percentUsed: 0, lastUpdated: Date.now() },
          tags: [],
          status: 'active',
          lastUsedAt: Date.now()
        })
        
        saveToStorage()
        addLog(`[${account.email}] ✓ ${t('auto_register.added_to_manager')}`)
        return true
      } else {
        addLog(`[${account.email}] ✗ ${t('auto_register.sso_import_failed')}: ${result.error?.message || t('common.unknown_error')}`)
        return false
      }
    } catch (error) {
      addLog(`[${account.email}] ✗ ${t('auto_register.import_error')}: ${error}`)
      return false
    }
  }

  // Single account registration task
  const registerSingleAccount = async (account: RegisterAccount): Promise<void> => {
    // Check global stop flag
    if (useAutoRegisterStore.getState().shouldStop) return
    if (account.status === 'success' || account.status === 'exists') return
    
    try {
      updateAccountStatus(account.id, { status: 'registering' })
      addLog(`[${account.email}] ${t('auto_register.starting_registration')}...`)
      
      // Resolve proxy: round-robin list takes precedence over the global single proxy
      const rotatedProxy = useAutoRegisterStore.getState().getNextProxy()
      const resolvedProxy = rotatedProxy ?? (proxyUrl || undefined)

      // Call main process auto-register function
      const result = await window.api.autoRegisterAWS({
        email: account.email,
        emailPassword: account.password,
        refreshToken: account.refreshToken,
        clientId: account.clientId,
        skipOutlookActivation: useAutoRegisterStore.getState().skipOutlookActivation,
        keepOutlookOpen: useAutoRegisterStore.getState().keepOutlookBrowserOpen,
        proxyUrl: resolvedProxy,
        browserEngine: useAutoRegisterStore.getState().browserEngine
      })
      
      if (result.success && result.ssoToken) {
        updateAccountStatus(account.id, { 
          status: 'success', 
          ssoToken: result.ssoToken,
          awsName: result.name
        })
        addLog(`[${account.email}] ✓ ${t('auto_register.registration_success')}!`)
        
        // Persist to Vault (upsert by email, mark done)
        useVaultStore.getState().upsertByEmail(account.email, {
          password: account.password,
          refreshToken: account.refreshToken,
          clientId: account.clientId,
          done: true,
          ssoToken: result.ssoToken,
          awsName: result.name,
          lastUsedAt: Date.now()
        })

        // Import account using SSO Token
        await importWithSsoToken(account, result.ssoToken, result.name || account.email.split('@')[0])
        
      } else {
        updateAccountStatus(account.id, { 
          status: 'failed', 
          error: result.error || t('auto_register.registration_failed')
        })
        addLog(`[${account.email}] ✗ ${t('auto_register.registration_failed')}: ${result.error}`)
      }
      
    } catch (error) {
      updateAccountStatus(account.id, { 
        status: 'failed', 
        error: String(error)
      })
      addLog(`[${account.email}] ✗ ${t('common.error')}: ${error}`)
    }
  }

  const startRegistration = async () => {
    // Filter out existing and successful accounts
    const pendingAccounts = accounts.filter(a => a.status === 'pending' || a.status === 'failed')
    
    if (pendingAccounts.length === 0) {
      alert(t('auto_register.no_pending_accounts'))
      return
    }
    
    setIsRunning(true)
    resetStop()
    addLog(`========== ${t('auto_register.starting_batch_registration')} (${t('auto_register.concurrency')}: ${concurrency}) ==========`)
    addLog(`${t('auto_register.pending')}: ${pendingAccounts.length}, ${t('auto_register.skipped')}: ${accounts.length - pendingAccounts.length}`)
    
    // Run concurrent registration tasks
    const runConcurrent = async () => {
      const queue = [...pendingAccounts]
      const running: Promise<void>[] = []
      
      while (queue.length > 0 || running.length > 0) {
        // Check global stop flag
        if (useAutoRegisterStore.getState().shouldStop) {
          addLog(t('auto_register.user_stopped'))
          break
        }
        
        // Fill to concurrency limit
        while (queue.length > 0 && running.length < concurrency) {
          const account = queue.shift()!
          const task = registerSingleAccount(account).then(() => {
            // Remove task from running when complete
            const index = running.indexOf(task)
            if (index > -1) running.splice(index, 1)
          })
          running.push(task)
        }
        
        // Wait for any task to complete
        if (running.length > 0) {
          await Promise.race(running)
        }
      }
    }
    
    await runConcurrent()
    
    setIsRunning(false)
    const stats = getStats()
    addLog(`========== ${t('auto_register.registration_complete')}: ${t('auto_register.success')} ${stats.success}，${t('auto_register.failed')} ${stats.failed} ==========`)
  }

  const stopRegistration = () => {
    requestStop()
    addLog(t('auto_register.stopping'))
  }

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token)
  }

  const exportResults = (format: 'csv' | 'markdown') => {
    if (accounts.length === 0) {
      alert(t('auto_register.no_results_to_export'))
      return
    }

    // done=1 for success/exists, empty for pending/failed/in-progress
    const doneValue = (a: RegisterAccount) =>
      a.status === 'success' || a.status === 'exists' ? '1' : ''

    let content = ''
    if (format === 'csv') {
      const sep = ','
      const header = ['email', 'password', 'refreshToken', 'clientId', 'done'].join(sep)
      const rows = accounts.map(a =>
        [a.email, a.password, a.refreshToken, a.clientId, doneValue(a)].join(sep)
      )
      content = [header, ...rows].join('\n')
    } else {
      const header = '| email | password | refreshToken | clientId | done |'
      const divider = '|---|---|---|---|---|'
      const rows = accounts.map(a =>
        `| ${a.email} | ${a.password} | ${a.refreshToken} | ${a.clientId} | ${doneValue(a)} |`
      )
      content = [header, divider, ...rows].join('\n')
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `register-results.${format === 'csv' ? 'csv' : 'md'}`
    link.click()
    URL.revokeObjectURL(url)
  }

  const copyPipeFormat = () => {
    if (accounts.length === 0) {
      alert(t('auto_register.no_results_to_export'))
      return
    }
    const doneValue = (a: RegisterAccount) =>
      a.status === 'success' || a.status === 'exists' ? '1' : ''
    const lines = accounts.map(a =>
      `${a.email}|${a.password}|${a.refreshToken}|${a.clientId}|${doneValue(a)}`
    )
    navigator.clipboard.writeText(lines.join('\n'))
    setPipeCopied(true)
    setTimeout(() => setPipeCopied(false), 2000)
  }

  const getStatusBadge = (status: RegisterAccount['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />{t('auto_register.pending')}</Badge>
      case 'exists':
        return <Badge variant="outline" className="text-orange-500 border-orange-500"><AlertCircle className="w-3 h-3 mr-1" />{t('auto_register.already_exists')}</Badge>
      case 'activating':
        return <Badge variant="default" className="bg-purple-500"><Zap className="w-3 h-3 mr-1 animate-pulse" />{t('auto_register.activating')}</Badge>
      case 'registering':
        return <Badge variant="default"><Loader2 className="w-3 h-3 mr-1 animate-spin" />{t('auto_register.registering')}</Badge>
      case 'getting_code':
        return <Badge variant="default"><Mail className="w-3 h-3 mr-1" />{t('auto_register.getting_code')}</Badge>
      case 'success':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />{t('auto_register.success')}</Badge>
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />{t('auto_register.failed')}</Badge>
    }
  }

  // Single Outlook activation task
  const activateSingleOutlook = async (account: RegisterAccount): Promise<void> => {
    if (useAutoRegisterStore.getState().shouldStop) return
    
    try {
      updateAccountStatus(account.id, { status: 'activating' })
      addLog(`[${account.email}] ${t('auto_register.starting_outlook_activation')}...`)
      
      const rotatedProxy = useAutoRegisterStore.getState().getNextProxy()
      const resolvedProxy = rotatedProxy ?? (proxyUrl || undefined)

      const result = await window.api.activateOutlook({
        email: account.email,
        emailPassword: account.password,
        browserEngine: useAutoRegisterStore.getState().browserEngine,
        proxyUrl: resolvedProxy
      })
      
      if (result.success) {
        updateAccountStatus(account.id, { status: 'pending' })
        addLog(`[${account.email}] ✓ ${t('auto_register.outlook_activation_success')}!`)
      } else {
        addLog(`[${account.email}] ⚠ ${t('auto_register.outlook_activation_incomplete')}: ${result.error}`)
      }
      
    } catch (error) {
      addLog(`[${account.email}] ✗ ${t('auto_register.activation_error')}: ${error}`)
    }
  }

  // Activate Outlook only (supports concurrency)
  const activateOutlookOnly = async () => {
    const outlookAccounts = accounts.filter(a => 
      a.email.toLowerCase().includes('outlook') && 
      a.password && 
      a.status !== 'exists' && 
      a.status !== 'success'
    )
    
    if (outlookAccounts.length === 0) {
      alert(t('auto_register.no_outlook_accounts'))
      return
    }
    
    setIsRunning(true)
    resetStop()
    addLog(`========== ${t('auto_register.starting_outlook_batch')} (${t('auto_register.concurrency')}: ${concurrency}) ==========`)
    
    // Run concurrent activation tasks
    const runConcurrent = async () => {
      const queue = [...outlookAccounts]
      const running: Promise<void>[] = []
      
      while (queue.length > 0 || running.length > 0) {
        if (useAutoRegisterStore.getState().shouldStop) {
          addLog(t('auto_register.user_stopped_activation'))
          break
        }
        
        while (queue.length > 0 && running.length < concurrency) {
          const account = queue.shift()!
          const task = activateSingleOutlook(account).then(() => {
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
    addLog(`========== ${t('auto_register.outlook_activation_complete')} ==========`)
  }

  const stats = getStats()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('auto_register.auto_register')}</h1>
          <p className="text-muted-foreground">
            {t('auto_register.auto_register_description')}
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <button
            type="button"
            onClick={() => setShowProxyPanel(v => !v)}
            disabled={isRunning}
            className={`px-3 py-1.5 border rounded-lg bg-background text-sm flex items-center gap-1.5 hover:bg-muted transition-colors ${showProxyPanel ? 'border-primary' : ''}`}
          >
            {proxyList.length > 0
              ? <><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold">{proxyList.length}</span>{t('auto_register.proxies_rotating')}</>
              : <>{t('auto_register.proxy_address')}{proxyUrl ? ` (1)` : ''}</>
            }
          </button>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">{t('auto_register.concurrency')}:</span>
            <select
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              disabled={isRunning}
              className="px-2 py-1.5 border rounded-lg bg-background text-sm w-16"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">{t('auto_register.browser')}:</span>
            <select
              value={browserEngine}
              onChange={(e) => setBrowserEngine(e.target.value as 'chromium' | 'cloakbrowser')}
              disabled={isRunning}
              className="px-2 py-1.5 border rounded-lg bg-background text-sm"
            >
              <option value="chromium">Chromium</option>
              <option value="cloakbrowser">CloakBrowser</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={skipOutlookActivation}
              onChange={(e) => setSkipOutlookActivation(e.target.checked)}
              disabled={isRunning}
              className="rounded"
            />
            {t('auto_register.skip_activation')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={keepOutlookBrowserOpen}
              onChange={(e) => setKeepOutlookBrowserOpen(e.target.checked)}
              disabled={isRunning}
              className="rounded"
            />
            {t('auto_register.keep_mail_browser_open')}
          </label>
          <Button variant="outline" onClick={activateOutlookOnly} disabled={isRunning || accounts.length === 0}>
            <Zap className="w-4 h-4 mr-2" />
            {t('auto_register.activate_outlook')}
          </Button>
          {isRunning ? (
            <Button variant="destructive" onClick={stopRegistration}>
              <Square className="w-4 h-4 mr-2" />
              {t('auto_register.stop')}
            </Button>
          ) : (
            <Button onClick={startRegistration} disabled={accounts.length === 0}>
              <Play className="w-4 h-4 mr-2" />
              {t('auto_register.start')}
            </Button>
          )}
        </div>
      </div>

      {/* Multi-proxy panel */}
      {showProxyPanel && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('auto_register.proxy_list_title')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('auto_register.proxy_list_desc')}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              className="w-full h-28 p-3 border rounded-lg bg-background resize-none font-mono text-sm"
              placeholder={`http://user:pass@host:port\nhttp://host2:port\nsocks5://host3:port`}
              value={proxyListText}
              onChange={(e) => setProxyListText(e.target.value)}
              disabled={isRunning}
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setProxyList(proxyListText)
                  setShowProxyPanel(false)
                }}
                disabled={isRunning}
              >
                {t('auto_register.proxy_save')}
              </Button>
              {proxyList.length === 0 && (
                <>
                  <span className="text-sm text-muted-foreground">{t('auto_register.proxy_fallback_label')}</span>
                  <input
                    type="text"
                    placeholder={t('auto_register.proxy_address')}
                    value={proxyUrl}
                    onChange={(e) => setProxy(true, e.target.value)}
                    disabled={isRunning}
                    className="px-3 py-1.5 border rounded-lg bg-background text-sm flex-1"
                  />
                </>
              )}
              {proxyList.length > 0 && (
                <span className="text-sm text-green-600 font-medium">
                  {proxyList.length} {t('auto_register.proxy_count_suffix')} — {t('auto_register.proxy_rotating')}
                </span>
              )}
              {proxyList.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setProxyList(''); setProxyListText('') }}
                  disabled={isRunning}
                >
                  {t('auto_register.proxy_clear')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">{t('auto_register.total')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
              <div className="text-sm text-muted-foreground">{t('auto_register.pending')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-500">{stats.running}</div>
              <div className="text-sm text-muted-foreground">{t('auto_register.running')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-500">{stats.success}</div>
              <div className="text-sm text-muted-foreground">{t('auto_register.success')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-500">{stats.failed}</div>
              <div className="text-sm text-muted-foreground">{t('auto_register.failed')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-orange-500">{stats.exists}</div>
              <div className="text-sm text-muted-foreground">{t('auto_register.already_exists')}</div>
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
              {t('auto_register.email_accounts')}
            </CardTitle>
            <CardDescription>
              {t('auto_register.format_description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              className="w-full h-32 p-3 border rounded-lg bg-background resize-none font-mono text-sm"
              placeholder="example@outlook.com|password|M.C509_xxx...|9e5f94bc-xxx...|done"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isRunning}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleImport} disabled={isRunning || !inputText}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {t('auto_register.parse_add')}
              </Button>
              <Button variant="outline" onClick={handleImportFile} disabled={isRunning}>
                <Upload className="w-4 h-4 mr-2" />
                {t('auto_register.import_from_file')}
              </Button>
              <Button variant="outline" onClick={handleClear} disabled={isRunning}>
                <Trash2 className="w-4 h-4 mr-2" />
                {t('auto_register.clear')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Right: Logs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              {t('auto_register.logs')}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={clearLogs}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-48 overflow-auto bg-black/90 rounded-lg p-3 font-mono text-xs space-y-0.5">
              {logs.length === 0 ? (
                <div className="text-gray-500">{t('auto_register.no_logs')}</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={
                    log.includes('✓') ? 'text-green-400' : 
                    log.includes('✗') || log.includes(t('common.error')) || log.includes(t('auto_register.failed')) ? 'text-red-400' : 
                    log.includes('=====') ? 'text-yellow-400' :
                    log.includes('[stderr]') ? 'text-orange-400' :
                    'text-gray-300'
                  }>
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              {t('auto_register.registration_list')}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyPipeFormat} title={t('auto_register.copy_pipe_format')}>
                {pipeCopied ? <CheckCircle className="w-4 h-4 mr-1 text-green-500" /> : <Copy className="w-4 h-4 mr-1" />}
                {pipeCopied ? t('auto_register.copied') : t('auto_register.copy_paste_format')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportResults('markdown')} title={t('auto_register.export_markdown')}>
                <Download className="w-4 h-4 mr-1" />
                Markdown
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportResults('csv')} title={t('auto_register.export_csv')}>
                <Download className="w-4 h-4 mr-1" />
                CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium">#</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">{t('dialogs.email')}</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">{t('auto_register.name')}</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">{t('auto_register.status')}</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">Token</th>
                    <th className="px-4 py-2 text-left text-sm font-medium">{t('common.edit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account, index) => (
                    <tr key={account.id} className="border-t">
                      <td className="px-4 py-2 text-sm">{index + 1}</td>
                      <td className="px-4 py-2 text-sm font-mono">{account.email}</td>
                      <td className="px-4 py-2 text-sm">{account.awsName || '-'}</td>
                      <td className="px-4 py-2">{getStatusBadge(account.status)}</td>
                      <td className="px-4 py-2 text-sm font-mono">
                        {account.ssoToken ? account.ssoToken.substring(0, 20) + '...' : '-'}
                      </td>
                      <td className="px-4 py-2">
                        {account.ssoToken && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => copyToken(account.ssoToken!)}
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
            {t('auto_register.usage_instructions')}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. {t('auto_register.instruction_1')} <code className="bg-muted px-1 rounded">{t('auto_register.format_example')}</code></p>
          <p className="pl-4 text-xs">
            - {t('auto_register.password_desc')}<br/>
            - {t('auto_register.refresh_token_desc')}<br/>
            - {t('auto_register.client_id_desc')}
          </p>
          <p>2. <strong>{t('auto_register.duplicate_detection')}</strong>: {t('auto_register.duplicate_detection_desc')}</p>
          <p>3. <strong>{t('auto_register.batch_concurrency')}</strong>: {t('auto_register.batch_concurrency_desc')}</p>
          <p>4. <strong>{t('auto_register.outlook_activation')}</strong>: {t('auto_register.outlook_activation_desc')}</p>
          <p className="pl-4 text-xs">
            - {t('auto_register.outlook_activation_step1')}<br/>
            - {t('auto_register.outlook_activation_step2')}
          </p>
          <p>5. <strong>{t('auto_register.proxy_settings')}</strong>: {t('auto_register.proxy_settings_desc')}</p>
          <p>6. {t('auto_register.instruction_6')}</p>
          <p className="text-yellow-500 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {t('auto_register.first_time_warning')} <code className="bg-muted px-1 rounded">npx playwright install chromium</code>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
