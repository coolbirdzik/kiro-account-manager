import { useAccountsStore } from '@/store/accounts'
import { Card, CardContent, CardHeader, CardTitle, Button } from '../ui'
import { Eye, EyeOff, RefreshCw, Clock, Trash2, Download, Upload, Globe, Repeat, Palette, Moon, Sun, Fingerprint, Info, ChevronDown, ChevronUp, Settings, Database, Layers, Server, Send, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { ExportDialog } from '../accounts/ExportDialog'
import { useTranslation } from 'react-i18next'

// 主题配置 - 按色系分组
const themeGroups = [
  {
    name: 'Blue',
    themes: [
      { id: 'default', name: 'Sky Blue', color: '#3b82f6' },
      { id: 'indigo', name: 'Indigo', color: '#6366f1' },
      { id: 'cyan', name: 'Cyan', color: '#06b6d4' },
      { id: 'sky', name: 'Sky', color: '#0ea5e9' },
      { id: 'teal', name: 'Teal', color: '#14b8a6' },
    ]
  },
  {
    name: 'Purple/Pink',
    themes: [
      { id: 'purple', name: 'Purple', color: '#a855f7' },
      { id: 'violet', name: 'Violet', color: '#8b5cf6' },
      { id: 'fuchsia', name: 'Fuchsia', color: '#d946ef' },
      { id: 'pink', name: 'Pink', color: '#ec4899' },
      { id: 'rose', name: 'Rose', color: '#f43f5e' },
    ]
  },
  {
    name: 'Warm',
    themes: [
      { id: 'red', name: 'Red', color: '#ef4444' },
      { id: 'orange', name: 'Orange', color: '#f97316' },
      { id: 'amber', name: 'Amber', color: '#f59e0b' },
      { id: 'yellow', name: 'Yellow', color: '#eab308' },
    ]
  },
  {
    name: 'Green',
    themes: [
      { id: 'emerald', name: 'Emerald', color: '#10b981' },
      { id: 'green', name: 'Green', color: '#22c55e' },
      { id: 'lime', name: 'Lime', color: '#84cc16' },
    ]
  },
  {
    name: 'Neutral',
    themes: [
      { id: 'slate', name: 'Slate', color: '#64748b' },
      { id: 'zinc', name: 'Zinc', color: '#71717a' },
      { id: 'stone', name: 'Stone', color: '#78716c' },
      { id: 'neutral', name: 'Neutral', color: '#737373' },
    ]
  }
]

export function SettingsPage() {
  const { t } = useTranslation()
  const { 
    privacyMode, 
    setPrivacyMode,
    autoRefreshEnabled,
    autoRefreshInterval,
    autoRefreshConcurrency,
    setAutoRefresh,
    setAutoRefreshConcurrency,
    proxyEnabled,
    proxyUrl,
    setProxy,
    autoSwitchEnabled,
    autoSwitchThreshold,
    autoSwitchInterval,
    setAutoSwitch,
    batchImportConcurrency,
    setBatchImportConcurrency,
    kiroServerUrl,
    kiroServerPassword,
    setKiroServer,
    theme,
    darkMode,
    setTheme,
    setDarkMode,
    accounts,
    importFromExportData
  } = useAccountsStore()

  const [showExportDialog, setShowExportDialog] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [tempProxyUrl, setTempProxyUrl] = useState(proxyUrl)
  const [themeExpanded, setThemeExpanded] = useState(false)

  // Kiro 服务器相关状态
  const [tempServerUrl, setTempServerUrl] = useState(kiroServerUrl)
  const [tempServerPassword, setTempServerPassword] = useState(kiroServerPassword)
  const [serverTestStatus, setServerTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [serverTestError, setServerTestError] = useState('')
  const [isImportingToServer, setIsImportingToServer] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; failed: number; errors: string[] } | null>(null)

  const handleExport = () => {
    setShowExportDialog(true)
  }

  const handleImport = async () => {
    setIsImporting(true)
    try {
      const fileData = await window.api.importFromFile()
      if (fileData && 'content' in fileData && fileData.format === 'json') {
        const data = JSON.parse(fileData.content)
        const importResult = importFromExportData(data)
        alert(t('settings_page.import_finished', { success: importResult.success, failed: importResult.failed }))
      } else if (fileData && 'isMultiple' in fileData) {
        alert(t('settings_page.batch_import_not_supported'))
      } else if (fileData) {
        alert(t('settings_page.only_json_supported'))
      }
    } catch (e) {
      alert(`${t('settings_page.import_failed')}: ${e instanceof Error ? e.message : t('common.unknown')}`)
    } finally {
      setIsImporting(false)
    }
  }

  const handleClearData = () => {
    if (confirm(t('settings_page.confirm_clear_data_1'))) {
      if (confirm(t('settings_page.confirm_clear_data_2'))) {
        // 清除所有数据
        Array.from(accounts.keys()).forEach(id => {
          useAccountsStore.getState().removeAccount(id)
        })
        alert(t('settings_page.data_cleared'))
      }
    }
  }

  // 测试服务器连接
  const handleTestServerConnection = async () => {
    if (!tempServerUrl || !tempServerPassword) {
      alert(t('settings_page.input_server_and_password'))
      return
    }
    
    setServerTestStatus('testing')
    setServerTestError('')
    
    try {
      const result = await window.api.testKiroServerConnection(tempServerUrl, tempServerPassword)
      if (result.success) {
        setServerTestStatus('success')
        // 保存设置
        setKiroServer(tempServerUrl, tempServerPassword)
      } else {
        setServerTestStatus('error')
        setServerTestError(result.error || t('settings_page.connection_failed'))
      }
    } catch (error) {
      setServerTestStatus('error')
      setServerTestError(error instanceof Error ? error.message : t('common.unknown'))
    }
  }

  // 导入账号到服务器
  const handleImportToServer = async () => {
    if (!kiroServerUrl || !kiroServerPassword) {
      alert(t('settings_page.configure_server_first'))
      return
    }
    
    const accountList = Array.from(accounts.values())
    if (accountList.length === 0) {
      alert(t('settings_page.no_accounts_to_import'))
      return
    }
    
    if (!confirm(t('settings_page.confirm_import_to_server', { count: accountList.length }))) {
      return
    }
    
    setIsImportingToServer(true)
    setImportResult(null)
    
    try {
      const result = await window.api.importToKiroServer({
        serverUrl: kiroServerUrl,
        password: kiroServerPassword,
        accounts: accountList
          .filter(acc => acc.credentials.refreshToken) // 过滤掉没有 refreshToken 的账号
          .map(acc => ({
            email: acc.email,
            accessToken: acc.credentials.accessToken,
            refreshToken: acc.credentials.refreshToken!,
            clientId: acc.credentials.clientId,
            clientSecret: acc.credentials.clientSecret,
            region: acc.credentials.region,
            idp: acc.idp,
            authMethod: acc.credentials.authMethod
          }))
      })
      
      if (result.success) {
        setImportResult({
          imported: result.imported || 0,
          failed: result.failed || 0,
          errors: result.errors || []
        })
      } else {
        alert(`${t('settings_page.import_failed')}: ${result.error}`)
      }
    } catch (error) {
      alert(`${t('settings_page.import_error')}: ${error instanceof Error ? error.message : t('common.unknown')}`)
    } finally {
      setIsImportingToServer(false)
    }
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      {/* 页面头部 */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 p-6 border border-primary/20">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-primary/20 to-transparent rounded-full blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary shadow-lg shadow-primary/25">
            <Settings className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary">{t('settings.settings')}</h1>
            <p className="text-muted-foreground">{t('settings_page.page_subtitle')}</p>
          </div>
        </div>
      </div>

      {/* 主题设置 */}
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Palette className="h-4 w-4 text-primary" />
            </div>
            {t('settings_page.theme_settings')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 深色模式 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t('settings.dark_mode')}</p>
              <p className="text-sm text-muted-foreground">{t('settings_page.switch_theme_mode')}</p>
            </div>
            <Button
              variant={darkMode ? "default" : "outline"}
              size="sm"
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? <Moon className="h-4 w-4 mr-2" /> : <Sun className="h-4 w-4 mr-2" />}
              {darkMode ? t('settings.dark') : t('settings.light')}
            </Button>
          </div>

          {/* 主题颜色 */}
          <div className="pt-2 border-t">
            <button 
              className="flex items-center justify-between w-full text-left"
              onClick={() => setThemeExpanded(!themeExpanded)}
            >
              <div className="flex items-center gap-2">
                <p className="font-medium">{t('settings_page.theme_color')}</p>
                {!themeExpanded && (
                  <div 
                    className="w-5 h-5 rounded-full ring-2 ring-primary ring-offset-1"
                    style={{ backgroundColor: themeGroups.flatMap(g => g.themes).find(t => t.id === theme)?.color || '#3b82f6' }}
                  />
                )}
              </div>
              {themeExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {themeExpanded && (
              <div className="space-y-3 mt-3">
                {themeGroups.map((group) => (
                  <div key={group.name} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-14 shrink-0">{group.name}</span>
                    <div className="flex flex-wrap gap-2">
                      {group.themes.map((t) => (
                        <button
                          key={t.id}
                          className={`group relative w-7 h-7 rounded-full transition-all ${
                            theme === t.id 
                              ? 'ring-2 ring-primary ring-offset-2 scale-110' 
                              : 'hover:scale-110 hover:shadow-md'
                          }`}
                          style={{ backgroundColor: t.color }}
                          onClick={() => setTheme(t.id)}
                          title={t.name}
                        >
                          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-popover px-1.5 py-0.5 rounded shadow-sm border pointer-events-none z-10">
                            {t.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 隐私设置 */}
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              {privacyMode ? <EyeOff className="h-4 w-4 text-primary" /> : <Eye className="h-4 w-4 text-primary" />}
            </div>
            {t('settings_page.privacy_settings')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t('settings.privacy_mode')}</p>
              <p className="text-sm text-muted-foreground">{t('settings_page.hide_sensitive_info')}</p>
            </div>
            <Button
              variant={privacyMode ? "default" : "outline"}
              size="sm"
              onClick={() => setPrivacyMode(!privacyMode)}
            >
              {privacyMode ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {privacyMode ? t('settings_page.enabled') : t('settings_page.disabled')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Token 刷新设置 */}
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <RefreshCw className="h-4 w-4 text-primary" />
            </div>
            {t('settings_page.auto_refresh')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t('settings_page.auto_refresh')}</p>
              <p className="text-sm text-muted-foreground">{t('settings_page.auto_refresh_desc')}</p>
            </div>
            <Button
              variant={autoRefreshEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefreshEnabled)}
            >
              {autoRefreshEnabled ? t('settings_page.enabled') : t('settings_page.disabled')}
            </Button>
          </div>

          {autoRefreshEnabled && (
            <>
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 space-y-1">
                <p>{t('settings_page.auto_refresh_tip_1')}</p>
                <p>{t('settings_page.auto_refresh_tip_2')}</p>
                <p>{t('settings_page.auto_refresh_tip_3')}</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <p className="font-medium">{t('settings_page.check_interval')}</p>
                  <p className="text-sm text-muted-foreground">{t('settings_page.check_interval_desc')}</p>
                </div>
                <select
                  className="w-[120px] h-9 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  value={autoRefreshInterval}
                  onChange={(e) => setAutoRefresh(true, parseInt(e.target.value))}
                >
                  <option value="1">{`1 ${t('common.minutes')}`}</option>
                  <option value="3">{`3 ${t('common.minutes')}`}</option>
                  <option value="5">{`5 ${t('common.minutes')}`}</option>
                  <option value="10">{`10 ${t('common.minutes')}`}</option>
                  <option value="15">{`15 ${t('common.minutes')}`}</option>
                  <option value="20">{`20 ${t('common.minutes')}`}</option>
                  <option value="30">{`30 ${t('common.minutes')}`}</option>
                  <option value="45">{`45 ${t('common.minutes')}`}</option>
                  <option value="60">{`60 ${t('common.minutes')}`}</option>
                </select>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <p className="font-medium">{t('settings_page.refresh_concurrency')}</p>
                  <p className="text-sm text-muted-foreground">{t('settings_page.refresh_concurrency_desc')}</p>
                </div>
                <input
                  type="number"
                  className="w-24 h-9 px-3 rounded-lg border bg-background text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  value={autoRefreshConcurrency}
                  min={1}
                  max={500}
                  onChange={(e) => setAutoRefreshConcurrency(parseInt(e.target.value) || 50)}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 代理设置 */}
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Globe className="h-4 w-4 text-primary" />
            </div>
            {t('settings_page.proxy_settings')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t('settings_page.enable_proxy')}</p>
              <p className="text-sm text-muted-foreground">{t('settings_page.proxy_desc')}</p>
            </div>
            <Button
              variant={proxyEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setProxy(!proxyEnabled, tempProxyUrl)}
            >
              {proxyEnabled ? t('settings_page.enabled') : t('settings_page.disabled')}
            </Button>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <label className="text-sm font-medium">{t('settings_page.proxy_url')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 h-9 px-3 rounded-lg border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                placeholder={t('settings_page.proxy_placeholder')}
                value={tempProxyUrl}
                onChange={(e) => setTempProxyUrl(e.target.value)}
              />
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setProxy(proxyEnabled, tempProxyUrl)}
                disabled={tempProxyUrl === proxyUrl}
              >
                {t('common.save')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('settings_page.proxy_help')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 自动换号设置 */}
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Repeat className="h-4 w-4 text-primary" />
            </div>
            {t('settings_page.auto_switch')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t('settings_page.enable_auto_switch')}</p>
              <p className="text-sm text-muted-foreground">{t('settings_page.auto_switch_desc')}</p>
            </div>
            <Button
              variant={autoSwitchEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoSwitch(!autoSwitchEnabled)}
            >
              {autoSwitchEnabled ? t('settings_page.enabled') : t('settings_page.disabled')}
            </Button>
          </div>

          {autoSwitchEnabled && (
            <>
              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <p className="font-medium">{t('settings_page.balance_threshold')}</p>
                  <p className="text-sm text-muted-foreground">{t('settings_page.balance_threshold_desc')}</p>
                </div>
                <input
                  type="number"
                  className="w-20 h-9 px-3 rounded-lg border bg-background text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  value={autoSwitchThreshold}
                  min={0}
                  onChange={(e) => setAutoSwitch(true, parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {t('settings_page.check_interval')}
                  </p>
                  <p className="text-sm text-muted-foreground">{t('settings_page.balance_check_interval_desc')}</p>
                </div>
                <select
                  className="h-9 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  value={autoSwitchInterval}
                  onChange={(e) => setAutoSwitch(true, undefined, parseInt(e.target.value))}
                >
                  <option value="1">{`1 ${t('common.minutes')}`}</option>
                  <option value="3">{`3 ${t('common.minutes')}`}</option>
                  <option value="5">{`5 ${t('common.minutes')}`}</option>
                  <option value="10">{`10 ${t('common.minutes')}`}</option>
                  <option value="15">{`15 ${t('common.minutes')}`}</option>
                  <option value="30">{`30 ${t('common.minutes')}`}</option>
                </select>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 批量导入设置 */}
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Layers className="h-4 w-4 text-primary" />
            </div>
            {t('settings_page.batch_import')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t('settings_page.concurrency')}</p>
              <p className="text-sm text-muted-foreground">{t('settings_page.concurrency_desc')}</p>
            </div>
            <input
              type="number"
              className="w-24 h-9 px-3 rounded-lg border bg-background text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              value={batchImportConcurrency}
              min={1}
              max={500}
              onChange={(e) => setBatchImportConcurrency(parseInt(e.target.value) || 100)}
            />
          </div>
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
            {t('settings_page.concurrency_tip')}
          </p>
        </CardContent>
      </Card>

      {/* 机器码管理提示 */}
      <Card className="border-0 shadow-sm bg-primary/5 border-primary/20 hover:shadow-md transition-shadow duration-200">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Fingerprint className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">{t('settings_page.machine_id_manage')}</p>
              <p className="text-xs text-muted-foreground">
                {t('settings_page.machine_id_manage_desc')}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Info className="h-3 w-3" />
              <span>{t('settings_page.machine_id_manage_hint')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kiro 服务器导入 */}
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Server className="h-4 w-4 text-primary" />
            </div>
            {t('settings_page.kiro_server_import')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            {t('settings_page.kiro_server_import_desc')}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('settings_page.server_url')}</label>
            <input
              type="text"
              className="w-full h-9 px-3 rounded-lg border bg-background text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              placeholder="http://your-server:18888"
              value={tempServerUrl}
              onChange={(e) => {
                setTempServerUrl(e.target.value)
                setServerTestStatus('idle')
              }}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('settings_page.admin_password')}</label>
            <input
              type="password"
              className="w-full h-9 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              placeholder={t('settings_page.admin_password_placeholder')}
              value={tempServerPassword}
              onChange={(e) => {
                setTempServerPassword(e.target.value)
                setServerTestStatus('idle')
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleTestServerConnection}
              disabled={serverTestStatus === 'testing' || !tempServerUrl || !tempServerPassword}
            >
              {serverTestStatus === 'testing' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : serverTestStatus === 'success' ? (
                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
              ) : serverTestStatus === 'error' ? (
                <XCircle className="h-4 w-4 mr-2 text-red-500" />
              ) : (
                <Globe className="h-4 w-4 mr-2" />
              )}
              {serverTestStatus === 'testing' ? t('settings_page.testing') : t('settings_page.test_connection')}
            </Button>
            
            {serverTestStatus === 'success' && (
              <span className="text-sm text-green-500">{t('settings_page.connection_success')}</span>
            )}
            {serverTestStatus === 'error' && (
              <span className="text-sm text-red-500">{serverTestError}</span>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              <p className="font-medium">{t('settings_page.import_to_server')}</p>
              <p className="text-sm text-muted-foreground">
                {t('settings_page.import_to_server_desc', { count: accounts.size })}
              </p>
            </div>
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleImportToServer}
              disabled={isImportingToServer || !kiroServerUrl || !kiroServerPassword || accounts.size === 0}
            >
              {isImportingToServer ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {isImportingToServer ? t('settings_page.importing') : t('settings_page.import')}
            </Button>
          </div>

          {importResult && (
            <div className={`text-sm p-3 rounded-lg ${importResult.failed > 0 ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}`}>
              <p>{t('settings_page.import_finished', { success: importResult.imported, failed: importResult.failed })}</p>
              {importResult.errors.length > 0 && (
                <div className="mt-2 text-xs">
                  <p className="font-medium">{t('settings_page.error_details')}</p>
                  <ul className="list-disc list-inside">
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li>{t('settings_page.more_errors', { count: importResult.errors.length - 5 })}</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 数据管理 */}
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Database className="h-4 w-4 text-primary" />
            </div>
            {t('settings_page.data_management')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t('settings_page.export_data')}</p>
              <p className="text-sm text-muted-foreground">{t('settings_page.export_data_desc')}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              {t('settings_page.export')}
            </Button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              <p className="font-medium">{t('settings_page.import_data')}</p>
              <p className="text-sm text-muted-foreground">{t('settings_page.import_data_desc')}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleImport} disabled={isImporting}>
              <Upload className="h-4 w-4 mr-2" />
              {isImporting ? t('settings_page.importing') : t('settings_page.import')}
            </Button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              <p className="font-medium text-destructive">{t('settings_page.clear_all_data')}</p>
              <p className="text-sm text-muted-foreground">{t('settings_page.clear_all_data_desc')}</p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleClearData}>
              <Trash2 className="h-4 w-4 mr-2" />
              {t('settings_page.clear')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 导出对话框 */}
      <ExportDialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        accounts={Array.from(accounts.values())}
        selectedCount={0}
      />
    </div>
  )
}
