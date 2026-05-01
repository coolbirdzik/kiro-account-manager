import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui'
import { Heart, Code, Info, Zap } from 'lucide-react'
import kiroLogo from '@/assets/kiro-high-resolution-logo-transparent.png'
import { useAccountsStore } from '@/store/accounts'
import { cn } from '@/lib/utils'

export function AboutPage() {
  const [version, setVersion] = useState('...')
  const { darkMode } = useAccountsStore()

  useEffect(() => {
    window.api.getAppVersion().then(setVersion)
  }, [])

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 p-8 border border-primary/20">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-primary/20 to-transparent rounded-full blur-2xl" />
        <div className="relative text-center space-y-4">
          <img 
            src={kiroLogo} 
            alt="Kiro" 
            className={cn("h-20 w-auto mx-auto transition-all", darkMode && "invert brightness-0")} 
          />
          <div>
            <h1 className="text-2xl font-bold text-primary">Kiro Account Manager</h1>
            <p className="text-muted-foreground">Version {version}</p>
          </div>
        </div>
      </div>

      {/* Description */}
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Info className="h-4 w-4 text-primary" />
            </div>
            About This Application
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <p>
            Kiro Account Manager is a powerful multi-account management tool for Kiro IDE.
            It supports quick account switching, automatic token refresh, group and tag management, machine ID management, and more,
            helping you efficiently manage and use multiple Kiro accounts.
          </p>
          <p>
            This application is developed using Electron + React + TypeScript, supporting Windows, macOS, and Linux platforms.
            All data is stored locally to protect your privacy and security.
          </p>
        </CardContent>
      </Card>

      {/* Features */}
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            Key Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <strong>Multi-Account Management</strong>: Add, edit, and delete multiple Kiro accounts
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <strong>One-Click Switching</strong>: Quickly switch between accounts
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <strong>Auto Refresh</strong>: Automatically refresh tokens before expiration
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <strong>Groups & Tags</strong>: Batch set groups/tags for multiple accounts
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <strong>Privacy Mode</strong>: Hide email and account sensitive information
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <strong>Batch Import</strong>: Support SSO Token and OIDC credential batch import
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <strong>Machine ID Management</strong>: Modify device identifiers to prevent account association bans
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <strong>Auto Machine ID Switch</strong>: Automatically change machine ID when switching accounts
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <strong>Account Machine ID Binding</strong>: Assign unique machine IDs to each account
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <strong>Auto Account Switching</strong>: Automatically switch to available accounts when balance is insufficient
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <strong>Proxy Support</strong>: Support HTTP/HTTPS/SOCKS5 proxies
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">✓</span>
              <strong>Theme Customization</strong>: 21 theme colors, dark/light mode
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Tech Stack */}
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Code className="h-4 w-4 text-primary" />
            </div>
            Tech Stack
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {['Electron', 'React', 'TypeScript', 'Tailwind CSS', 'Zustand', 'Vite'].map((tech) => (
              <span 
                key={tech}
                className="px-2.5 py-1 text-xs bg-muted rounded-full text-muted-foreground"
              >
                {tech}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground py-4">
        <p className="flex items-center justify-center gap-1">
          Made with <Heart className="h-3 w-3 text-primary" /> for Kiro users
        </p>
      </div>
    </div>
  )
}
