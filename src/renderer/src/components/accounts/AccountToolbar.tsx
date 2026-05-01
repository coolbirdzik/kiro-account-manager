import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Badge } from '../ui'
import { useAccountsStore } from '@/store/accounts'
import { AccountFilterPanel } from './AccountFilter'
import {
  Search,
  Plus,
  Upload,
  Download,
  RefreshCw,
  Trash2,
  Tag,
  FolderPlus,
  CheckSquare,
  Square,
  Loader2,
  Eye,
  EyeOff,
  Filter,
  ChevronDown,
  Check,
  X,
  Minus
} from 'lucide-react'

interface AccountToolbarProps {
  onAddAccount: () => void
  onImport: () => void
  onExport: () => void
  onManageGroups: () => void
  onManageTags: () => void
  isFilterExpanded: boolean
  onToggleFilter: () => void
}

export function AccountToolbar({
  onAddAccount,
  onImport,
  onExport,
  onManageGroups,
  onManageTags,
  isFilterExpanded,
  onToggleFilter
}: AccountToolbarProps): React.ReactNode {
  const { t } = useTranslation()
  const {
    filter,
    setFilter,
    selectedIds,
    selectAll,
    deselectAll,
    removeAccounts,
    batchRefreshTokens,
    batchCheckStatus,
    getFilteredAccounts,
    getStats,
    privacyMode,
    setPrivacyMode,
    groups,
    tags,
    accounts,
    moveAccountsToGroup,
    addTagToAccounts,
    removeTagFromAccounts
  } = useAccountsStore()

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [showGroupMenu, setShowGroupMenu] = useState(false)
  const [showTagMenu, setShowTagMenu] = useState(false)
  
  const groupMenuRef = useRef<HTMLDivElement>(null)
  const tagMenuRef = useRef<HTMLDivElement>(null)
  
  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) {
        setShowGroupMenu(false)
      }
      if (tagMenuRef.current && !tagMenuRef.current.contains(e.target as Node)) {
        setShowTagMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // 获取选中账户的分组和标签状态
  const getSelectedAccountsGroupStatus = () => {
    const selectedAccounts = Array.from(selectedIds).map(id => accounts.get(id)).filter(Boolean)
    const groupCounts = new Map<string | undefined, number>()
    
    selectedAccounts.forEach(acc => {
      if (acc) {
        const gid = acc.groupId
        groupCounts.set(gid, (groupCounts.get(gid) || 0) + 1)
      }
    })
    
    return { selectedAccounts, groupCounts }
  }
  
  const getSelectedAccountsTagStatus = () => {
    const selectedAccounts = Array.from(selectedIds).map(id => accounts.get(id)).filter(Boolean)
    const tagCounts = new Map<string, number>()
    
    selectedAccounts.forEach(acc => {
      if (acc?.tags) {
        acc.tags.forEach(tagId => {
          tagCounts.set(tagId, (tagCounts.get(tagId) || 0) + 1)
        })
      }
    })
    
    return { selectedAccounts, tagCounts, total: selectedAccounts.length }
  }
  
  // 处理分组操作
  const handleMoveToGroup = (groupId: string | undefined) => {
    if (selectedIds.size === 0) return
    moveAccountsToGroup(Array.from(selectedIds), groupId)
    setShowGroupMenu(false)
  }
  
  // 处理标签操作
  const handleAddTag = (tagId: string) => {
    if (selectedIds.size === 0) return
    addTagToAccounts(Array.from(selectedIds), tagId)
  }
  
  const handleRemoveTag = (tagId: string) => {
    if (selectedIds.size === 0) return
    removeTagFromAccounts(Array.from(selectedIds), tagId)
  }
  
  const handleToggleTag = (tagId: string) => {
    const { tagCounts, total } = getSelectedAccountsTagStatus()
    const count = tagCounts.get(tagId) || 0
    
    if (count === total) {
      // 所有选中账户都有此标签，移除
      handleRemoveTag(tagId)
    } else {
      // 部分或无账户有此标签，添加
      handleAddTag(tagId)
    }
  }

  const stats = getStats()
  const filteredCount = getFilteredAccounts().length
  const selectedCount = selectedIds.size

  const handleSearch = (value: string): void => {
    setFilter({ ...filter, search: value || undefined })
  }

  const handleBatchRefresh = async (): Promise<void> => {
    if (selectedCount === 0) return
    setIsRefreshing(true)
    await batchRefreshTokens(Array.from(selectedIds))
    setIsRefreshing(false)
  }

  const handleBatchCheck = async (): Promise<void> => {
    if (selectedCount === 0) return
    setIsChecking(true)
    await batchCheckStatus(Array.from(selectedIds))
    setIsChecking(false)
  }

  const handleBatchDelete = (): void => {
    if (selectedCount === 0) return
    if (confirm(t('accounts.confirm_delete_multiple', { count: selectedCount }))) {
      removeAccounts(Array.from(selectedIds))
    }
  }

  const handleToggleSelectAll = (): void => {
    if (selectedCount === filteredCount && filteredCount > 0) {
      deselectAll()
    } else {
      selectAll()
    }
  }

  return (
    <div className="space-y-3">
      {/* 搜索和主要操作 */}
      <div className="flex items-center gap-3">
        {/* 搜索框 */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
           <input
             type="text"
             placeholder={t('accounts.search_accounts')}
             className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
             value={filter.search ?? ''}
             onChange={(e) => handleSearch(e.target.value)}
           />
        </div>

        {/* 主要操作按钮 */}
         <Button onClick={onAddAccount}>
           <Plus className="h-4 w-4 mr-1" />
           {t('accounts.add_account')}
         </Button>
         <Button variant="outline" onClick={onImport}>
           <Upload className="h-4 w-4 mr-1" />
           {t('accounts.import_accounts')}
         </Button>
         <Button variant="outline" onClick={onExport}>
           <Download className="h-4 w-4 mr-1" />
           {t('accounts.export_accounts')}
         </Button>
      </div>

      {/* 统计和选择操作 */}
      <div className="flex items-center justify-between">
        {/* Left side: Statistics */}
         <div className="flex items-center gap-4 text-sm">
           <span className="text-muted-foreground">
             {t('account_toolbar.total_accounts', { count: stats.total })}
             {filteredCount !== stats.total && (
               <span>, {t('account_toolbar.filtered_accounts', { count: filteredCount })}</span>
             )}
           </span>
           {stats.expiringSoonCount > 0 && (
             <Badge variant="destructive" className="gap-1">
               {stats.expiringSoonCount} {t('home.expiring_soon')}
             </Badge>
           )}
         </div>

        {/* 右侧：选择操作和管理 */}
        <div className="flex items-center gap-2">
          {/* 分组下拉菜单 */}
          <div className="relative" ref={groupMenuRef}>
            <Button 
              variant={showGroupMenu ? "default" : "ghost"} 
              size="sm" 
              onClick={() => {
                if (selectedCount > 0) {
                  setShowGroupMenu(!showGroupMenu)
                  setShowTagMenu(false)
                } else {
                  onManageGroups()
                }
              }}
               title={selectedCount > 0 ? t('accounts.set_group') : t('accounts.manage_groups')}
             >
               <FolderPlus className="h-4 w-4 mr-1" />
               {t('accounts.group_name')}
               {selectedCount > 0 && <ChevronDown className="h-3 w-3 ml-1" />}
             </Button>
             
             {showGroupMenu && selectedCount > 0 && (
               <div className="absolute left-0 top-full mt-2 z-50 min-w-[200px] bg-popover border rounded-lg shadow-lg p-2">
                 <div className="absolute -top-2 left-4 w-4 h-4 bg-popover border-l border-t rotate-45" />
                 <div className="text-xs text-muted-foreground px-2 py-1 mb-1">
                   {t('account_toolbar.batch_selected', { count: selectedCount })}
                 </div>
                 <div className="border-t my-1" />
                 
                 {/* Remove group */}
                 <button
                   className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
                   onClick={() => handleMoveToGroup(undefined)}
                 >
                   <X className="h-4 w-4 text-muted-foreground" />
                   <span>{t('account_toolbar.remove_group')}</span>
                  {(() => {
                    const { groupCounts, selectedAccounts } = getSelectedAccountsGroupStatus()
                    const noGroupCount = groupCounts.get(undefined) || 0
                    if (noGroupCount === selectedAccounts.length) {
                      return <Check className="h-4 w-4 ml-auto text-primary" />
                    }
                    return null
                  })()}
                </button>
                
                <div className="border-t my-1" />
                
                {/* 分组列表 */}
                {Array.from(groups.values()).map(group => {
                  const { groupCounts, selectedAccounts } = getSelectedAccountsGroupStatus()
                  const count = groupCounts.get(group.id) || 0
                  const isAllInGroup = count === selectedAccounts.length
                  
                  return (
                    <button
                      key={group.id}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
                      onClick={() => handleMoveToGroup(group.id)}
                    >
                      <div 
                        className="w-3 h-3 rounded-full shrink-0" 
                        style={{ backgroundColor: group.color || '#888' }} 
                      />
                      <span className="truncate flex-1">{group.name}</span>
                      {isAllInGroup && <Check className="h-4 w-4 text-primary" />}
                      {count > 0 && !isAllInGroup && (
                        <span className="text-xs text-muted-foreground">{count}</span>
                      )}
                    </button>
                  )
                })}
                
                 {groups.size === 0 && (
                   <div className="text-sm text-muted-foreground px-2 py-2 text-center">
                     {t('accounts.no_results')}
                   </div>
                 )}
                 
                 <div className="border-t my-1" />
                 <button
                   className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-primary"
                   onClick={() => {
                     setShowGroupMenu(false)
                     onManageGroups()
                   }}
                 >
                   <Plus className="h-4 w-4" />
                   <span>{t('accounts.manage_groups')}</span>
                </button>
              </div>
            )}
          </div>
          
          {/* 标签下拉菜单 */}
          <div className="relative" ref={tagMenuRef}>
            <Button 
              variant={showTagMenu ? "default" : "ghost"} 
              size="sm" 
              onClick={() => {
                if (selectedCount > 0) {
                  setShowTagMenu(!showTagMenu)
                  setShowGroupMenu(false)
                } else {
                  onManageTags()
                }
              }}
               title={selectedCount > 0 ? t('accounts.add_tags') : t('accounts.manage_tags')}
             >
               <Tag className="h-4 w-4 mr-1" />
               {t('accounts.tag_name')}
               {selectedCount > 0 && <ChevronDown className="h-3 w-3 ml-1" />}
             </Button>
             
             {showTagMenu && selectedCount > 0 && (
               <div className="absolute left-0 top-full mt-2 z-50 min-w-[220px] bg-popover border rounded-lg shadow-lg p-2">
                 <div className="absolute -top-2 left-4 w-4 h-4 bg-popover border-l border-t rotate-45" />
                 <div className="text-xs text-muted-foreground px-2 py-1 mb-1">
                   {t('account_toolbar.batch_selected_action', { count: selectedCount, action: t('accounts.add_tags') })}
                 </div>
                 <div className="border-t my-1" />
                 
                 {/* Tags list */}
                 <div className="max-h-[300px] overflow-y-auto">
                   {Array.from(tags.values()).map(tag => {
                     const { tagCounts, total } = getSelectedAccountsTagStatus()
                     const count = tagCounts.get(tag.id) || 0
                     const isAll = count === total
                     const isPartial = count > 0 && count < total
                     
                     return (
                       <button
                         key={tag.id}
                         className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
                         onClick={() => handleToggleTag(tag.id)}
                       >
                         <div 
                           className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                           style={{ 
                             backgroundColor: isAll ? (tag.color || '#888') : 'transparent',
                             borderColor: tag.color || '#888'
                           }}
                         >
                           {isAll && <Check className="h-3 w-3 text-white" />}
                           {isPartial && <Minus className="h-3 w-3" style={{ color: tag.color || '#888' }} />}
                         </div>
                         <span className="truncate flex-1">{tag.name}</span>
                         {isPartial && (
                           <span className="text-xs text-muted-foreground">{count}/{total}</span>
                         )}
                       </button>
                     )
                   })}
                 </div>
                 
                 {tags.size === 0 && (
                   <div className="text-sm text-muted-foreground px-2 py-2 text-center">
                     {t('accounts.no_results')}
                   </div>
                 )}
                 
                 <div className="border-t my-1" />
                 <button
                   className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-primary"
                   onClick={() => {
                     setShowTagMenu(false)
                     onManageTags()
                   }}
                 >
                   <Plus className="h-4 w-4" />
                   <span>{t('accounts.manage_tags')}</span>
                </button>
              </div>
            )}
          </div>
           <Button
             variant={privacyMode ? "default" : "ghost"}
             size="sm"
             onClick={() => setPrivacyMode(!privacyMode)}
             title={privacyMode ? t('settings.privacy_mode') : t('settings.privacy_mode')}
           >
             {privacyMode ? (
               <EyeOff className="h-4 w-4 mr-1" />
             ) : (
               <Eye className="h-4 w-4 mr-1" />
             )}
             {t('settings.privacy_mode')}
           </Button>
           {/* Filter button and bubble */}
           <div className="relative">
             <Button
               variant={isFilterExpanded ? "default" : "ghost"}
               size="sm"
               onClick={onToggleFilter}
               title={t('accounts.filter_by_status')}
             >
               <Filter className="h-4 w-4 mr-1" />
               {t('accounts.filter_by_status')}
             </Button>
             {/* Filter bubble panel */}
             {isFilterExpanded && (
               <div className="absolute right-0 top-full mt-2 z-50 min-w-[600px] bg-popover border rounded-lg shadow-lg">
                 {/* Bubble arrow */}
                 <div className="absolute -top-2 right-4 w-4 h-4 bg-popover border-l border-t rotate-45" />
                 <AccountFilterPanel />
               </div>
             )}
           </div>

           <div className="w-px h-6 bg-border mx-2" />

           {/* Batch operations */}
           <Button
             variant="ghost"
             size="sm"
             onClick={handleBatchCheck}
             disabled={isChecking || selectedCount === 0}
             title={t('accounts.check_account_info')}
           >
             {isChecking ? (
               <Loader2 className="h-4 w-4 mr-1 animate-spin" />
             ) : (
               <RefreshCw className="h-4 w-4 mr-1" />
             )}
             {t('common.refresh')}
           </Button>
           <Button
             variant="ghost"
             size="sm"
             className="text-destructive hover:text-destructive"
             onClick={handleBatchDelete}
             disabled={selectedCount === 0}
             title={t('common.delete')}
           >
             <Trash2 className="h-4 w-4 mr-1" />
             {t('common.delete')}
           </Button>
           <Button
             variant="ghost"
             size="sm"
             onClick={handleBatchRefresh}
             disabled={isRefreshing || selectedCount === 0}
             title={t('accounts.refresh_token')}
           >
             {isRefreshing ? (
               <Loader2 className="h-4 w-4 mr-1 animate-spin" />
             ) : (
               <RefreshCw className="h-4 w-4 mr-1" />
             )}
             {t('accounts.refresh_token')}
           </Button>

           <div className="w-px h-6 bg-border mx-2" />

           {/* Select all */}
           <Button
             variant="ghost"
             size="sm"
             onClick={handleToggleSelectAll}
           >
             {selectedCount === filteredCount && filteredCount > 0 ? (
               <CheckSquare className="h-4 w-4 mr-1" />
             ) : (
               <Square className="h-4 w-4 mr-1" />
             )}
             {selectedCount > 0 ? `${t('accounts.batch_operations')} ${selectedCount}` : t('accounts.select_all')}
           </Button>
        </div>
      </div>
    </div>
  )
}
