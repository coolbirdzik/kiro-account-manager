import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import { Button } from './ui'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'zh' : 'en'
    i18n.changeLanguage(newLang)
    localStorage.setItem('language', newLang)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      title={i18n.language === 'en' ? t('language.switch_to_chinese') : t('language.switch_to_english')}
      className="flex items-center gap-2"
    >
      <Globe className="h-4 w-4" />
      <span className="text-xs font-medium">{i18n.language.toUpperCase()}</span>
    </Button>
  )
}
