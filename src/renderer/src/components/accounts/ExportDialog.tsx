import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, Badge } from '../ui'
import { X, FileJson, FileText, Table, Clipboard, Check, Download, Files } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAccountsStore } from '@/store/accounts'
import type { Account } from '@/types/account'
import { useTranslation } from 'react-i18next'

type ExportFormat = 'json' | 'json-single' | 'txt' | 'csv' | 'clipboard'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  accounts: Account[]
  selectedCount: number
}

export function ExportDialog({ open, onClose, accounts, selectedCount }: ExportDialogProps) {
  const { t } = useTranslation()
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json')
  const [includeCredentials, setIncludeCredentials] = useState(true)
  const [copied, setCopied] = useState(false)
  const { exportAccounts } = useAccountsStore()

  if (!open) return null

  const formats: { id: ExportFormat; name: string; icon: typeof FileJson; desc: string }[] = [
    { id: 'json', name: 'JSON', icon: FileJson, desc: t('export_dialog.json_desc') },
    { id: 'json-single', name: t('export_dialog.single_json'), icon: Files, desc: t('export_dialog.single_json_desc') },
    { id: 'txt', name: 'TXT', icon: FileText, desc: includeCredentials ? t('export_dialog.txt_desc_with_credentials') : t('export_dialog.txt_desc') },
    { id: 'csv', name: 'CSV', icon: Table, desc: includeCredentials ? t('export_dialog.csv_desc_with_credentials') : t('export_dialog.csv_desc') },
    { id: 'clipboard', name: t('export_dialog.clipboard'), icon: Clipboard, desc: includeCredentials ? t('export_dialog.clipboard_desc_with_credentials') : t('export_dialog.clipboard_desc') },
  ]

  // 生成单个账号的完整 JSON 数据
  const generateSingleAccountJson = (acc: Account): string => {
    const singleExport = {
      version: '1.0',
      exportedAt: Date.now(),
      account: {
        ...acc,
        isActive: false, // 导出时不保留激活状态
        credentials: includeCredentials ? acc.credentials : {
          ...acc.credentials,
          accessToken: '',
          refreshToken: '',
          csrfToken: ''
        }
      }
    }
    return JSON.stringify(singleExport, null, 2)
  }

  // 生成导出内容
  const generateContent = (format: ExportFormat): string => {
    switch (format) {
      case 'json':
        // 使用 store 的 exportAccounts 函数导出完整数据
        const exportData = exportAccounts(accounts.map(a => a.id))
        // 如果不包含凭证，移除敏感信息
        if (!includeCredentials) {
          exportData.accounts = exportData.accounts.map(acc => ({
            ...acc,
            credentials: {
              ...acc.credentials,
              accessToken: '',
              refreshToken: '',
              csrfToken: ''
            }
          }))
        }
        return JSON.stringify(exportData, null, 2)

      case 'txt':
        if (includeCredentials) {
          // 包含凭证时导出可导入格式：邮箱,RefreshToken,昵称,登录方式
          return accounts.map(acc => 
            [
              acc.email,
              acc.credentials?.refreshToken || '',
              acc.nickname || '',
              acc.idp || 'Google'
            ].join(',')
          ).join('\n')
        }
        // 不包含凭证时导出摘要信息
        return accounts.map(acc => {
          const lines = [
            t('export_dialog.txt_line_email', { value: acc.email }),
            acc.nickname ? t('export_dialog.txt_line_nickname', { value: acc.nickname }) : null,
            acc.idp ? t('export_dialog.txt_line_idp', { value: acc.idp }) : null,
            acc.subscription?.title ? t('export_dialog.txt_line_subscription', { value: acc.subscription.title }) : null,
            acc.usage ? t('export_dialog.txt_line_usage', { current: acc.usage.current ?? 0, limit: acc.usage.limit ?? 0 }) : null,
          ].filter(Boolean)
          return lines.join('\n')
        }).join(`\n\n${t('export_dialog.txt_account_separator')}\n\n`)

      case 'csv':
        // CSV 格式：包含凭证时可用于导入
        const headers = includeCredentials 
          ? [
              t('export_dialog.csv_email'),
              t('export_dialog.csv_nickname'),
              t('export_dialog.csv_idp'),
              'RefreshToken',
              'ClientId',
              'ClientSecret',
              'Region'
            ]
          : [
              t('export_dialog.csv_email'),
              t('export_dialog.csv_nickname'),
              t('export_dialog.csv_idp'),
              t('export_dialog.csv_subscription_type'),
              t('export_dialog.csv_subscription_title'),
              t('export_dialog.csv_usage_current'),
              t('export_dialog.csv_usage_limit')
            ]
        const rows = accounts.map(acc => includeCredentials 
          ? [
              acc.email,
              acc.nickname || '',
              acc.idp || '',
              acc.credentials?.refreshToken || '',
              acc.credentials?.clientId || '',
              acc.credentials?.clientSecret || '',
              acc.credentials?.region || 'us-east-1'
            ]
          : [
              acc.email,
              acc.nickname || '',
              acc.idp || '',
              acc.subscription?.type || '',
              acc.subscription?.title || '',
              String(acc.usage?.current ?? ''),
              String(acc.usage?.limit ?? '')
            ]
        )
        // 添加 BOM 以支持 Excel 中文
        return '\ufeff' + [headers, ...rows].map(row => 
          row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ).join('\n')

      case 'clipboard':
        if (includeCredentials) {
          // 包含凭证时导出可导入格式：邮箱,RefreshToken
          return accounts.map(acc => 
            `${acc.email},${acc.credentials?.refreshToken || ''}`
          ).join('\n')
        }
        // 不包含凭证时导出摘要信息
        return accounts.map(acc => 
          `${acc.email}${acc.nickname ? ` (${acc.nickname})` : ''} - ${acc.subscription?.title || t('export_dialog.unknown_subscription')}`
        ).join('\n')

      default:
        return ''
    }
  }

  // 导出处理
  const handleExport = async () => {
    const count = accounts.length

    // 单账号 JSON 导出：选择文件夹，批量导出所有文件
    if (selectedFormat === 'json-single') {
      const files = accounts.map(acc => {
        const content = generateSingleAccountJson(acc)
        const safeEmail = acc.email.replace(/[@.]/g, '_')
        const filename = `kiro-account-${safeEmail}.json`
        return { filename, content }
      })
      
      const result = await window.api.exportToFolder(files)
      if (result.success) {
        alert(t('export_dialog.exported_to_folder', { success: result.count, total: count }))
        onClose()
      }
      return
    }

    const content = generateContent(selectedFormat)

    if (selectedFormat === 'clipboard') {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
        onClose()
      }, 1500)
      return
    }

    const extensions: Record<string, string> = {
      json: 'json',
      txt: 'txt',
      csv: 'csv'
    }
    const filename = `kiro-accounts-${new Date().toISOString().slice(0, 10)}.${extensions[selectedFormat]}`
    
    const success = await window.api.exportToFile(content, filename)
    if (success) {
      alert(t('export_dialog.exported_count', { count }))
      onClose()
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 对话框 */}
      <div className="relative bg-background rounded-xl shadow-2xl w-[450px] animate-in fade-in zoom-in-95 duration-200">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            <h2 className="text-lg font-semibold">{t('accounts.export_accounts')}</h2>
            <Badge variant="secondary">
              {selectedCount > 0 ? t('export_dialog.selected_count', { count: selectedCount }) : t('export_dialog.all_count', { count: accounts.length })}
            </Badge>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* 格式选择 */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {formats.map(format => {
              const Icon = format.icon
              const isSelected = selectedFormat === format.id
              return (
                <button
                  key={format.id}
                  onClick={() => setSelectedFormat(format.id)}
                  className={cn(
                    "p-4 rounded-lg border-2 text-left transition-all",
                    isSelected 
                      ? "border-primary bg-primary/5" 
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={cn("h-4 w-4", isSelected && "text-primary")} />
                    <span className={cn("font-medium", isSelected && "text-primary")}>
                      {format.name}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{format.desc}</p>
                </button>
              )
            })}
          </div>

          {/* 选项 */}
          {(selectedFormat === 'json' || selectedFormat === 'json-single') && (
            <label className="flex items-center gap-2 p-3 bg-muted rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={includeCredentials}
                onChange={(e) => setIncludeCredentials(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <div>
                <p className="text-sm font-medium">{t('export_dialog.include_credentials')}</p>
                <p className="text-xs text-muted-foreground">{t('export_dialog.include_credentials_desc')}</p>
              </div>
            </label>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleExport} disabled={copied}>
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                {t('export_dialog.copied')}
              </>
            ) : selectedFormat === 'clipboard' ? (
              <>
                <Clipboard className="h-4 w-4 mr-2" />
                {t('export_dialog.copy_to_clipboard')}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                {t('accounts.export_accounts')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
