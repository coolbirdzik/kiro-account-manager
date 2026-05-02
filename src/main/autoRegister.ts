/**
 * AWS Builder ID Auto Registration Module
 * Fully integrated in Electron, no external Python script dependencies
 * 
 * Email parameter format: email|password|refresh_token|client_id
 * - refresh_token: OAuth2 refresh token (e.g., M.C509_xxx...)
 * - client_id: Graph API client ID (e.g., 9e5f94bc-xxx...)
 */

import { chromium, Browser, Page, LaunchOptions } from 'playwright'

type LogCallback = (message: string) => void
export type BrowserEngine = 'chromium' | 'cloakbrowser'

async function launchBrowser(engine: BrowserEngine, opts: LaunchOptions): Promise<Browser> {
  if (engine === 'cloakbrowser') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { launch } = await import('cloakbrowser') as any
    return launch(opts) as Browser
  }
  return chromium.launch(opts)
}

// Verification code patterns - ordered from most specific to most generic
const CODE_PATTERNS = [
  // "Verification code: 123456" / "verification code is 123456" / "code is 123456"
  /(?:verification\s*code|one[\s-]*time\s*code|security\s*code|your\s*code\s*is|code\s*is)[\s：:\-]*?(\d{6})\b/gi,
  // "is 123456" with verification context nearby (handled by context filter below)
  /\bis[\s：:\-]+(\d{6})\b/gi,
  // 6-digit number on its own line (very common AWS layout)
  /(?:^|\n)\s*(\d{6})\s*(?:$|\n)/g,
  // 6-digit number between HTML tags
  />\s*(\d{6})\s*</g,
  // Last resort: any standalone 6-digit number surrounded by whitespace
  /(?:^|[\s>])(\d{6})(?=[\s<]|$)/g,
]

// Keywords that indicate the email is a verification email (used for fuzzy matching when sender is unknown)
const VERIFICATION_KEYWORDS = [
  'verification code',
  'verify your email',
  'verify your account',
  'one-time code',
  'one time code',
  'security code',
  'aws builder',
  'builder id',
  'amazon',
  'aws',
  'signin.aws'
]

// Known AWS verification code senders (substring match, lowercase)
const AWS_SENDERS = [
  'signin.aws',
  'login.awsapps.com',
  'awsapps.com',
  'amazon.com',
  'aws.amazon.com',
  'verify.signin.aws',
  'no-reply@aws',
  'noreply@aws',
  'aws'
]

// Random name generation
const FIRST_NAMES = ['James', 'Robert', 'John', 'Michael', 'David', 'William', 'Richard', 'Maria', 'Elizabeth', 'Jennifer', 'Linda', 'Barbara', 'Susan', 'Jessica']
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Thomas', 'Taylor']

function generateRandomName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
  return `${first} ${last}`
}

// HTML to text - improved version
function htmlToText(html: string): string {
  if (!html) return ''
  
  let text = html
  
  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
  
  // Remove style and script tags and their content
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  
  // Convert br and p tags to line breaks
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/p>/gi, '\n')
  text = text.replace(/<\/div>/gi, '\n')
  
  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, ' ')
  
  // Clean up extra whitespace
  text = text.replace(/\s+/g, ' ')
  
  return text.trim()
}

// Extract verification code from text - improved version
function extractCode(text: string): string | null {
  if (!text) return null

  for (const pattern of CODE_PATTERNS) {
    // Always create a fresh regex copy to avoid lastIndex state pollution
    const re = new RegExp(pattern.source, pattern.flags)

    let match: RegExpExecArray | null
    while ((match = re.exec(text)) !== null) {
      const code = match[1]
      if (!code || !/^\d{6}$/.test(code)) continue

      // Get context for exclusion check
      const start = Math.max(0, match.index - 30)
      const end = Math.min(text.length, match.index + match[0].length + 30)
      const context = text.slice(start, end)

      // Exclude color codes (#XXXXXX)
      if (context.includes('#' + code)) continue

      // Exclude CSS color related
      if (/color\s*[:=]\s*[^;]*\d{6}/i.test(context)) continue
      if (/rgb\s*\(|rgba\s*\(|hsl\s*\(/i.test(context)) continue

      // Exclude numbers that are part of a longer digit string (phone/postal/year+digits)
      // Check the chars immediately before/after the matched 6 digits
      const codeStart = match.index + match[0].indexOf(code)
      const before = codeStart > 0 ? text[codeStart - 1] : ''
      const after = codeStart + 6 < text.length ? text[codeStart + 6] : ''
      if (/\d/.test(before) || /\d/.test(after)) continue

      // Exclude obvious year-like patterns (e.g. 202401 won't pass digit check above anyway)
      // Exclude all-zero or trivial sequences
      if (code === '000000' || code === '111111') continue

      return code
    }
  }
  return null
}


/**
 * Get verification code from Outlook mailbox
 * Using Microsoft Graph API, consistent with Python version
 */
export async function getOutlookVerificationCode(
  refreshToken: string,
  clientId: string,
  log: LogCallback,
  timeout: number = 120
): Promise<string | null> {
  log('========== Starting to get email verification code ==========')
  log(`client_id: ${clientId}`)
  log(`refresh_token: ${refreshToken.substring(0, 30)}...`)
  
  const startTime = Date.now()
  const checkInterval = 5000 // 5 seconds check interval
  const checkedIds = new Set<string>()
  
  while (Date.now() - startTime < timeout * 1000) {
    try {
      // Refresh access_token
      log('Refreshing access_token...')
      let accessToken: string | null = null
      
      const tokenAttempts = [
        { url: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token', scope: null },
        { url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token', scope: null },
      ]
      
      for (const attempt of tokenAttempts) {
        try {
          const tokenBody = new URLSearchParams()
          tokenBody.append('client_id', clientId)
          tokenBody.append('refresh_token', refreshToken)
          tokenBody.append('grant_type', 'refresh_token')
          if (attempt.scope) {
            tokenBody.append('scope', attempt.scope)
          }
          
          const tokenResponse = await fetch(attempt.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenBody.toString()
          })
          
          if (tokenResponse.ok) {
            const tokenResult = await tokenResponse.json() as { access_token: string }
            accessToken = tokenResult.access_token
            log('✓ Successfully obtained access_token')
            break
          }
        } catch {
          continue
        }
      }
      
      if (!accessToken) {
        log('✗ Token refresh failed')
        return null
      }
      
      // Fetch email list from multiple folders (Inbox + JunkEmail)
      // AWS verification emails frequently land in the Junk folder for fresh Outlook accounts
      type GraphMail = {
        id: string
        subject: string
        from: { emailAddress: { address: string; name?: string } }
        body: { content: string; contentType?: string }
        bodyPreview: string
        receivedDateTime: string
        parentFolderId?: string
      }

      const fetchFolder = async (folderPath: string, label: string): Promise<GraphMail[]> => {
        const params = new URLSearchParams({
          '$top': '25',
          '$orderby': 'receivedDateTime desc',
          '$select': 'id,subject,from,receivedDateTime,bodyPreview,body,parentFolderId'
        })
        const url = folderPath
          ? `https://graph.microsoft.com/v1.0/me/mailFolders/${folderPath}/messages?${params}`
          : `https://graph.microsoft.com/v1.0/me/messages?${params}`
        try {
          const resp = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              // Ask Graph for plain-text body to make regex matching reliable
              'Prefer': 'outlook.body-content-type="text"'
            }
          })
          if (!resp.ok) {
            log(`  · ${label}: failed (${resp.status})`)
            return []
          }
          const data = await resp.json() as { value: GraphMail[] }
          log(`  · ${label}: ${data.value?.length || 0} emails`)
          return data.value || []
        } catch (e) {
          log(`  · ${label}: error ${e}`)
          return []
        }
      }

      log('Fetching email list (Inbox + JunkEmail)...')
      const [inboxMails, junkMails] = await Promise.all([
        fetchFolder('Inbox', 'Inbox'),
        fetchFolder('JunkEmail', 'Junk')
      ])

      // Merge & dedupe, sort newest first
      const seen = new Set<string>()
      const allMails: GraphMail[] = []
      for (const m of [...inboxMails, ...junkMails]) {
        if (!seen.has(m.id)) {
          seen.add(m.id)
          allMails.push(m)
        }
      }
      allMails.sort((a, b) => (b.receivedDateTime || '').localeCompare(a.receivedDateTime || ''))

      // Pass 1: emails matching known AWS senders
      // Pass 2: emails containing verification keywords (fallback when sender list is outdated)
      const tryExtract = (mail: GraphMail, reason: string): string | null => {
        log(`\n=== Checking email (${reason}) ===`)
        log(`  From: ${mail.from?.emailAddress?.address || '(unknown)'}`)
        log(`  Subject: ${(mail.subject || '').substring(0, 80)}`)
        log(`  Received: ${mail.receivedDateTime}`)
        log(`  Preview: ${(mail.bodyPreview || '').substring(0, 120).replace(/\s+/g, ' ')}`)

        const rawBody = mail.body?.content || ''
        const contentType = mail.body?.contentType || ''
        // If body is HTML (Prefer header may be ignored on some tenants), convert to text
        const textBody = contentType.toLowerCase() === 'html' || /<[a-z][^>]*>/i.test(rawBody)
          ? htmlToText(rawBody)
          : rawBody

        let code = extractCode(textBody)
        if (!code) code = extractCode(rawBody)
        if (!code) code = extractCode(mail.bodyPreview || '')
        if (!code) code = extractCode((mail.subject || ''))
        return code
      }

      // Pass 1
      for (const mail of allMails) {
        if (checkedIds.has(mail.id)) continue
        const fromEmail = mail.from?.emailAddress?.address?.toLowerCase() || ''
        const isAwsSender = AWS_SENDERS.some(s => fromEmail.includes(s.toLowerCase()))
        if (!isAwsSender) continue

        checkedIds.add(mail.id)
        const code = tryExtract(mail, 'AWS sender')
        if (code) {
          log(`\n========== Found verification code: ${code} ==========`)
          return code
        }
        log('  → no 6-digit code matched in this email')
      }

      // Pass 2: fallback by content keywords (last 10 minutes only to avoid stale codes)
      const cutoff = Date.now() - 10 * 60 * 1000
      for (const mail of allMails) {
        if (checkedIds.has(mail.id)) continue
        const received = Date.parse(mail.receivedDateTime || '') || 0
        if (received < cutoff) continue

        const haystack = `${mail.subject || ''} ${mail.bodyPreview || ''}`.toLowerCase()
        const hasKeyword = VERIFICATION_KEYWORDS.some(k => haystack.includes(k))
        if (!hasKeyword) continue

        checkedIds.add(mail.id)
        const code = tryExtract(mail, 'verification keyword fallback')
        if (code) {
          log(`\n========== Found verification code (fallback): ${code} ==========`)
          return code
        }
        log('  → no 6-digit code matched in this email')
      }

      log(`No verification code found yet, retrying in ${checkInterval / 1000}s...`)
      await new Promise(r => setTimeout(r, checkInterval))
      
    } catch (error) {
      log(`Error getting verification code: ${error}`)
      await new Promise(r => setTimeout(r, checkInterval))
    }
  }
  
  log('Getting verification code timed out')
  return null
}


/**
 * Wait for the user to manually type a 6-digit verification code into the given input.
 * Polls the input's value until it contains exactly 6 digits, then returns it.
 * Used as a fallback when Microsoft Graph credentials are not provided.
 */
async function waitForManualCodeInput(
  page: Page,
  inputSelector: string,
  log: LogCallback,
  timeoutMs: number = 5 * 60 * 1000
): Promise<string | null> {
  const start = Date.now()
  let lastNotice = 0
  log('========================================================')
  log('  ⚠ No refresh_token / client_id provided.')
  log('  → Please OPEN your Outlook inbox manually, copy the')
  log('    6-digit AWS Builder ID verification code, and PASTE')
  log('    it into the verification input in the open browser.')
  log('  → The script will detect it and continue automatically.')
  log(`  Waiting up to ${Math.round(timeoutMs / 1000)}s...`)
  log('========================================================')

  while (Date.now() - start < timeoutMs) {
    try {
      const value = await page.locator(inputSelector).first().inputValue({ timeout: 2000 })
      const digits = (value || '').replace(/\D/g, '')
      if (/^\d{6}$/.test(digits)) {
        log(`✓ Detected 6-digit code entered manually: ${digits}`)
        return digits
      }
    } catch {
      // Page may be navigating; ignore transient errors and continue polling
    }

    // Print a heartbeat every 15s so the user knows we are still waiting
    if (Date.now() - lastNotice > 15000) {
      lastNotice = Date.now()
      const elapsed = Math.round((Date.now() - start) / 1000)
      log(`  ...still waiting for manual code (${elapsed}s elapsed)`)
    }
    await page.waitForTimeout(1500)
  }
  log('✗ Manual code entry timed out')
  return null
}

/**
 * Wait for input field to appear and fill content
 */
async function waitAndFill(
  page: Page,
  selector: string,
  value: string,
  log: LogCallback,
  description: string,
  timeout: number = 30000
): Promise<boolean> {
  log(`Waiting for ${description} to appear...`)
  try {
    const element = page.locator(selector).first()
    await element.waitFor({ state: 'visible', timeout })
    await page.waitForTimeout(500)
    await element.clear()
    await element.fill(value)
    log(`✓ Filled ${description}: ${value}`)
    return true
  } catch (error) {
    log(`✗ ${description} operation failed: ${error}`)
    return false
  }
}

/**
 * Try clicking multiple selectors
 */
async function tryClickSelectors(
  page: Page,
  selectors: string[],
  log: LogCallback,
  description: string,
  timeout: number = 15000
): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first()
      await element.waitFor({ state: 'visible', timeout: timeout / selectors.length })
      await page.waitForTimeout(300)
      await element.click()
      log(`✓ Clicked ${description}`)
      return true
    } catch {
      continue
    }
  }
  log(`✗ ${description} not found`)
  return false
}

/**
 * Detect AWS error popup and retry clicking button
 * Error popup selector: div.awsui_content_mx3cw_97dyn_391 contains "Sorry, there was an error processing your request"
 */
async function checkAndRetryOnError(
  page: Page,
  buttonSelector: string,
  log: LogCallback,
  description: string,
  maxRetries: number = 3,
  retryDelay: number = 2000
): Promise<boolean> {
  // Multiple possible selectors for error popup
  const errorSelectors = [
    'div.awsui_content_mx3cw_97dyn_391',
    '[class*="awsui_content_"]',
    '.awsui-flash-error',
    '[data-testid="flash-error"]'
  ]
  
  const errorTexts = [
    'Sorry, there was an error processing your request',
    'Sorry, there was an error processing your request',
    'error processing your request',
    'Please try again',
    'Please try again'
  ]
  
  for (let retry = 0; retry < maxRetries; retry++) {
    // Wait a bit for page to respond
    await page.waitForTimeout(1500)
    
    // Check if there's an error popup
    let hasError = false
    for (const selector of errorSelectors) {
      try {
        const errorElements = await page.locator(selector).all()
        for (const el of errorElements) {
          const text = await el.textContent()
          if (text && errorTexts.some(errText => text.includes(errText))) {
            hasError = true
            log(`⚠ Error popup detected: "${text.substring(0, 50)}..."`)
            break
          }
        }
        if (hasError) break
      } catch {
        continue
      }
    }
    
    if (!hasError) {
      // No error, operation successful
      return true
    }
    
    if (retry < maxRetries - 1) {
      log(`Retrying click ${description} (${retry + 2}/${maxRetries})...`)
      await page.waitForTimeout(retryDelay)
      
      // Re-click button
      try {
        const button = page.locator(buttonSelector).first()
        await button.waitFor({ state: 'visible', timeout: 5000 })
        await button.click()
        log(`✓ Re-clicked ${description}`)
      } catch (e) {
        log(`✗ Re-click ${description} failed: ${e}`)
      }
    }
  }
  
  log(`✗ ${description} still failed after multiple retries`)
  return false
}

/**
 * Wait for button to appear and click, with error detection and auto-retry
 */
async function waitAndClickWithRetry(
  page: Page,
  selector: string,
  log: LogCallback,
  description: string,
  timeout: number = 30000,
  maxRetries: number = 3
): Promise<boolean> {
  log(`Waiting for ${description} to appear...`)
  try {
    const element = page.locator(selector).first()
    await element.waitFor({ state: 'visible', timeout })
    await page.waitForTimeout(500)
    await element.click()
    log(`✓ Clicked ${description}`)
    
    // Check if there's an error popup, if yes then retry
    const success = await checkAndRetryOnError(page, selector, log, description, maxRetries)
    return success
  } catch (error) {
    log(`✗ Failed to click ${description}: ${error}`)
    return false
  }
}

/**
 * Try to refresh the Outlook inbox so newly arrived emails appear immediately.
 * Best-effort: silently ignored if the refresh button cannot be found.
 */
async function refreshOutlookInbox(page: Page): Promise<void> {
  const refreshSelectors = [
    'button[aria-label="Sync this view"]',
    'button[aria-label*="Refresh" i]',
    'button[aria-label*="Sync" i]',
    'button[title*="Refresh" i]',
    'button[title*="Sync" i]'
  ]
  for (const sel of refreshSelectors) {
    try {
      const btn = page.locator(sel).first()
      if (await btn.isVisible({ timeout: 800 })) {
        await btn.click({ timeout: 1500 })
        return
      }
    } catch {
      continue
    }
  }
  // Fallback: keyboard shortcut F9 reloads the message list in Outlook web
  try { await page.keyboard.press('F9') } catch { /* ignore */ }
}

/**
 * Click the most recent AWS verification email in an already-open Outlook inbox
 * and read the 6-digit OTP from the rendered email body.
 *
 * Used as a fallback when Microsoft Graph credentials are not provided.
 */
export async function readOtpFromOutlookPage(
  page: Page,
  log: LogCallback,
  timeoutMs: number = 3 * 60 * 1000
): Promise<string | null> {
  log('========================================================')
  log('  Reading OTP directly from the open Outlook tab...')
  log('  (will click the latest AWS email automatically)')
  log('========================================================')

  const start = Date.now()
  const triedKeys = new Set<string>()
  let lastHeartbeat = 0

  // Mail-list item selectors. Outlook web uses different DOMs per account type
  // (Live / Hotmail / personal / 365); cover the common variants.
  const listItemSelectors = [
    'div[role="option"][aria-label*="signin.aws" i]',
    'div[role="option"][aria-label*="AWS Builder" i]',
    'div[role="option"][aria-label*="Verify your AWS" i]',
    'div[role="option"][aria-label*="verification" i]',
    'div[role="listitem"][aria-label*="AWS" i]',
    '[data-convid] [aria-label*="AWS" i]'
  ]

  while (Date.now() - start < timeoutMs) {
    try {
      // Refresh inbox so new mail appears
      await refreshOutlookInbox(page)
      await page.waitForTimeout(1500)

      // Try each selector to locate an AWS-related mail row
      let clicked = false
      for (const sel of listItemSelectors) {
        try {
          const candidates = await page.locator(sel).all()
          for (const item of candidates) {
            const label = (await item.getAttribute('aria-label').catch(() => '')) || ''
            // De-dup on aria-label so we don't keep re-clicking the same email
            // (re-clicking after a successful click is fine but skipping is faster)
            const key = label.slice(0, 200)
            if (triedKeys.has(key)) continue

            try {
              await item.scrollIntoViewIfNeeded({ timeout: 1500 })
              await item.click({ timeout: 3000 })
              triedKeys.add(key)
              clicked = true
              log(`  → Clicked email: ${label.slice(0, 100)}`)
              await page.waitForTimeout(2500)
              break
            } catch {
              continue
            }
          }
          if (clicked) break
        } catch {
          continue
        }
      }

      // Try to extract code from the reading pane / whole document body.
      // The reading pane mounts inside a [role="document"] / [role="region"] container;
      // falling back to the full body innerText still works because the just-clicked
      // email is rendered there and other 6-digit numbers are filtered by extractCode.
      const readingPaneSelectors = [
        '[role="document"]',
        '[aria-label*="Message body" i]',
        '[role="region"][aria-label*="Reading pane" i]',
        '[role="main"]'
      ]
      let pageText = ''
      for (const sel of readingPaneSelectors) {
        try {
          const el = page.locator(sel).first()
          if (await el.isVisible({ timeout: 800 })) {
            pageText = await el.innerText({ timeout: 2000 })
            if (pageText && pageText.length > 50) break
          }
        } catch {
          continue
        }
      }
      if (!pageText) {
        try {
          pageText = await page.locator('body').innerText({ timeout: 2000 })
        } catch { /* ignore */ }
      }

      // Only consider text that mentions verification / AWS to avoid picking
      // a stray 6-digit number from an unrelated email shown in the preview list.
      if (pageText && /(verification\s*code|aws builder|signin\.aws|amazon)/i.test(pageText)) {
        const code = extractCode(pageText)
        if (code) {
          log(`✓ OTP read from Outlook page: ${code}`)
          return code
        }
      }

      if (Date.now() - lastHeartbeat > 12000) {
        lastHeartbeat = Date.now()
        const elapsed = Math.round((Date.now() - start) / 1000)
        log(`  ...waiting for AWS email in inbox (${elapsed}s)`)
      }
    } catch (e) {
      log(`  · iteration error: ${e}`)
    }
    await page.waitForTimeout(3000)
  }

  log('✗ Could not read OTP from Outlook page within timeout')
  return null
}

/**
 * Outlook mailbox activation
 * Activate Outlook mailbox before AWS registration to ensure normal receipt of verification codes.
 *
 * When `keepOpen` is true, the browser/page are returned in the result instead of being closed,
 * so the caller can reuse the authenticated Outlook tab to read OTP emails directly.
 */
export async function activateOutlook(
  email: string,
  emailPassword: string,
  log: LogCallback,
  keepOpen: boolean = false,
  engine: BrowserEngine = 'chromium',
  proxyUrl?: string
): Promise<{ success: boolean; error?: string; browser?: Browser; page?: Page }> {
  const activationUrl = 'https://go.microsoft.com/fwlink/p/?linkid=2125442'
  let browser: Browser | null = null
  
  log('========== Starting Outlook mailbox activation ==========')
  log(`Email: ${email}`)
  if (engine === 'cloakbrowser') log('Browser: CloakBrowser')
  if (proxyUrl) log(`Proxy: ${proxyUrl}`)
  
  try {
    // Start browser
    log('\nStep 1: Start browser, access Outlook activation page...')
    browser = await launchBrowser(engine, {
      headless: false,
      proxy: proxyUrl ? { server: proxyUrl } : undefined,
      args: ['--disable-blink-features=AutomationControlled']
    })
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    
    const page = await context.newPage()
    
    await page.goto(activationUrl, { waitUntil: 'networkidle', timeout: 60000 })
    log('✓ Page loaded successfully')
    await page.waitForTimeout(2000)
    
    // Step 2: Wait for email input field and enter email
    log('\nStep 2: Enter email...')
    const emailInputSelectors = [
      'input#i0116[type="email"]',
      'input[name="loginfmt"]',
      'input[type="email"]'
    ]
    
    let emailFilled = false
    for (const selector of emailInputSelectors) {
      try {
        const element = page.locator(selector).first()
        await element.waitFor({ state: 'visible', timeout: 10000 })
        await element.fill(email)
        log(`✓ Email entered: ${email}`)
        emailFilled = true
        break
      } catch {
        continue
      }
    }
    
    if (!emailFilled) {
      throw new Error('Email input field not found')
    }
    
    await page.waitForTimeout(1000)
    
    // Step 3: Click first Next button
    log('\nStep 3: Click Next button...')
    const firstNextSelectors = [
      'input#idSIButton9[type="submit"]',
      'input[type="submit"][value="Next"]'
    ]
    
    if (!await tryClickSelectors(page, firstNextSelectors, log, 'First Next button')) {
      throw new Error('Failed to click first Next button')
    }
    
    await page.waitForTimeout(3000)
    
    // Step 4: Wait for password input field and enter password
    log('\nStep 4: Enter password...')
    const passwordInputSelectors = [
      'input#passwordEntry[type="password"]',
      'input#i0118[type="password"]',
      'input[name="passwd"][type="password"]',
      'input[type="password"]'
    ]
    
    let passwordFilled = false
    for (const selector of passwordInputSelectors) {
      try {
        const element = page.locator(selector).first()
        await element.waitFor({ state: 'visible', timeout: 15000 })
        await element.fill(emailPassword)
        log('✓ Password entered')
        passwordFilled = true
        break
      } catch {
        continue
      }
    }
    
    if (!passwordFilled) {
      throw new Error('Password input field not found')
    }
    
    await page.waitForTimeout(1000)
    
    // Step 5: Click second Next/Login button
    log('\nStep 5: Click login button...')
    const loginButtonSelectors = [
      'button[type="submit"][data-testid="primaryButton"]',
      'input#idSIButton9[type="submit"]',
      'button:has-text("Sign in")',
      'button:has-text("Next")'
    ]
    
    if (!await tryClickSelectors(page, loginButtonSelectors, log, 'Login button')) {
      throw new Error('Failed to click login button')
    }
    
    await page.waitForTimeout(3000)
    
    // Step 6: Wait for first "Skip for now" link and click
    log('\nStep 6: Click first "Skip for now" link...')
    const skipSelector = 'a#iShowSkip'
    try {
      const skipElement = page.locator(skipSelector).first()
      await skipElement.waitFor({ state: 'visible', timeout: 30000 })
      await skipElement.click()
      log('✓ Clicked first "Skip for now"')
      await page.waitForTimeout(3000)
    } catch {
      log('First "Skip for now" link not found, may have skipped this step')
    }
    
    // Step 7: Wait for second "Skip for now" link and click
    log('\nStep 7: Click second "Skip for now" link...')
    try {
      const skipElement = page.locator(skipSelector).first()
      await skipElement.waitFor({ state: 'visible', timeout: 15000 })
      await skipElement.click()
      log('✓ Clicked second "Skip for now"')
      await page.waitForTimeout(3000)
    } catch {
      log('Second "Skip for now" link not found, may have skipped this step')
    }
    
    // Step 8: Wait for "Cancel" button (key creation dialog) and click
    log('\nStep 8: Click "Cancel" button (skip key creation)...')
    const cancelButtonSelectors = [
      'button[data-testid="secondaryButton"]:has-text("Cancel")',
      'button[type="button"]:has-text("Cancel")'
    ]
    
    if (!await tryClickSelectors(page, cancelButtonSelectors, log, '"Cancel" button', 15000)) {
      log('"Cancel" button not found, may have skipped this step')
    }
    
    await page.waitForTimeout(3000)
    
    // Step 9: Wait for "Yes" button (keep signed in) and click
    log('\nStep 9: Click "Yes" button (stay signed in)...')
    const yesButtonSelectors = [
      'button[type="submit"][data-testid="primaryButton"]:has-text("Yes")',
      'input#idSIButton9[value="Yes"]',
      'button:has-text("Yes")'
    ]
    
    if (!await tryClickSelectors(page, yesButtonSelectors, log, '"Yes" button', 15000)) {
      log('"Yes" button not found, may have skipped this step')
    }
    
    await page.waitForTimeout(5000)
    
    // Step 10: Wait for Outlook mailbox to load
    log('\nStep 10: Wait for Outlook mailbox to load...')
    const newMailSelectors = [
      'button[aria-label="New email"]',
      'button:has-text("New email")',
      'span:has-text("New email")',
      '[data-automation-type="RibbonSplitButton"]'
    ]
    
    let outlookLoaded = false
    for (const selector of newMailSelectors) {
      try {
        const element = page.locator(selector).first()
        await element.waitFor({ state: 'visible', timeout: 30000 })
        log('✓ Outlook mailbox activated successfully!')
        outlookLoaded = true
        break
      } catch {
        continue
      }
    }
    
    if (!outlookLoaded) {
      // Check if already on inbox page
      const currentUrl = page.url()
      if (currentUrl.toLowerCase().includes('outlook') || currentUrl.toLowerCase().includes('mail')) {
        log('✓ Entered Outlook mailbox page, activation successful!')
        outlookLoaded = true
      }
    }
    
    await page.waitForTimeout(2000)

    if (keepOpen) {
      // Hand the authenticated Outlook session back to the caller. They are
      // responsible for closing the browser when done.
      log('\n========== Outlook mailbox activation completed (kept open) ==========')
      return outlookLoaded
        ? { success: true, browser, page }
        : { success: false, error: 'Outlook mailbox activation may not be completed', browser, page }
    }

    await browser.close()
    browser = null

    if (outlookLoaded) {
      log('\n========== Outlook mailbox activation completed ==========')
      return { success: true }
    } else {
      log('\n⚠ Outlook mailbox activation may not be completed')
      return { success: false, error: 'Outlook mailbox activation may not be completed' }
    }

  } catch (error) {
    log(`\n✗ Outlook activation failed: ${error}`)
    if (browser) {
      try { await browser.close() } catch {}
    }
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * AWS Builder ID Auto Registration
 * @param email Email address
 * @param refreshToken OAuth2 refresh token
 * @param clientId Graph API client ID
 * @param log Log callback
 * @param emailPassword Email password (for Outlook activation)
 * @param skipOutlookActivation Whether to skip Outlook activation
 * @param proxyUrl Proxy address (only for AWS registration, not for Outlook activation or verification code retrieval)
 */
export async function autoRegisterAWS(
  email: string,
  refreshToken: string,
  clientId: string,
  log: LogCallback,
  emailPassword?: string,
  skipOutlookActivation: boolean = false,
  proxyUrl?: string,
  keepOutlookOpen: boolean = true,
  engine: BrowserEngine = 'chromium'
): Promise<{ success: boolean; ssoToken?: string; name?: string; error?: string }> {
  const password = 'admin123456aA!'
  const randomName = generateRandomName()
  let browser: Browser | null = null

  // Keep the Outlook tab open when the caller requests it and a password is provided,
  // so the user can visually confirm whether the verification email arrived and type
  // the code manually if automatic fetching fails.
  // When Graph creds are also present the tab is only used as a visual aid —
  // the code is still fetched via Graph API first.
  const useOutlookPageForOtp = keepOutlookOpen && !!emailPassword
  let outlookBrowser: Browser | null = null
  let outlookPage: Page | null = null

  // If it's an Outlook email and password is provided, activate first (without proxy)
  if (!skipOutlookActivation && email.toLowerCase().includes('outlook') && emailPassword) {
    log('Detected Outlook email, activating first (without proxy)...')
    const activationResult = await activateOutlook(email, emailPassword, log, useOutlookPageForOtp, engine)
    if (!activationResult.success) {
      log(`⚠ Outlook activation may not be complete: ${activationResult.error}`)
      log('Continuing with AWS registration...')
    } else {
      log('Outlook activation successful, starting AWS registration...')
    }
    if (useOutlookPageForOtp && activationResult.browser && activationResult.page) {
      outlookBrowser = activationResult.browser
      outlookPage = activationResult.page
      if (refreshToken && clientId) {
        log('→ Outlook tab kept open for visual reference (OTP will be fetched via Graph API).')
      } else {
        log('→ Outlook tab kept open: will read OTP from inbox (or enter manually).')
      }
    }
    // Wait a moment before continuing
    await new Promise(r => setTimeout(r, 2000))
  }
  
  log('========== Starting AWS Builder ID Registration ==========')
  log(`Email: ${email}`)
  log(`Name: ${randomName}`)
  log(`Password: ${password}`)
  if (proxyUrl) {
    log(`Proxy: ${proxyUrl}`)
  }
  
  try {
    // Step 1: Create browser, enter registration page (using proxy)
    log('\nStep 1: Launching browser, entering registration page...')
    if (engine === 'cloakbrowser') log('Browser: CloakBrowser')
    browser = await launchBrowser(engine, {
      headless: false,
      proxy: proxyUrl ? { server: proxyUrl } : undefined,
      args: ['--disable-blink-features=AutomationControlled']
    })
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    
    const page = await context.newPage()
    
    const registerUrl = 'https://view.awsapps.com/start/#/device?user_code=PQCF-FCCN'
    await page.goto(registerUrl, { waitUntil: 'networkidle', timeout: 60000 })
    log('✓ Page loaded successfully')
    await page.waitForTimeout(2000)
    
    // Wait for email input field to appear and enter email
    // Selector: input[placeholder="username@example.com"]
    const emailInputSelector = 'input[placeholder="username@example.com"]'
    if (!await waitAndFill(page, emailInputSelector, email, log, 'Email input field')) {
      throw new Error('Email input field not found')
    }
    
    await page.waitForTimeout(1000)
    
    // Click first Continue button (with error detection and auto-retry)
    // Selector: button[data-testid="test-primary-button"]
    const firstContinueSelector = 'button[data-testid="test-primary-button"]'
    if (!await waitAndClickWithRetry(page, firstContinueSelector, log, 'First Continue button')) {
      throw new Error('Failed to click first Continue button')
    }
    
    await page.waitForTimeout(3000)
    
    // Check if already registered (login page or verification page)
    // Login page indicator 1: span contains "Sign in with your AWS Builder ID"
    // Login page indicator 2: Page contains "verify" text with verification code input field
    const loginHeadingSelector = 'span[class*="awsui_heading-text"]:has-text("Sign in with your AWS Builder ID")'
    const verifyHeadingSelector = 'span[class*="awsui_heading-text"]:has-text("Verify")'
    const verifyCodeInputSelector = 'input[placeholder="6-digit"]'
    const nameInputSelector = 'input[placeholder="Maria José Silva"]'
    
    let isLoginFlow = false
    let isVerifyFlow = false  // Login flow that goes directly to verification code step
    
    try {
      // Check for login page, verification page, and registration page elements simultaneously
      const loginHeading = page.locator(loginHeadingSelector).first()
      const verifyHeading = page.locator(verifyHeadingSelector).first()
      const verifyCodeInput = page.locator(verifyCodeInputSelector).first()
      const nameInput = page.locator(nameInputSelector).first()
      
      // Wait for one of the elements to appear
      const result = await Promise.race([
        loginHeading.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'login'),
        verifyHeading.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'verify'),
        verifyCodeInput.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'verify-input'),
        nameInput.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'register')
      ])
      
      if (result === 'login') {
        isLoginFlow = true
      } else if (result === 'verify' || result === 'verify-input') {
        isLoginFlow = true
        isVerifyFlow = true
      }
    } catch {
      // If none found, try checking individually
      try {
        await page.locator(loginHeadingSelector).first().waitFor({ state: 'visible', timeout: 3000 })
        isLoginFlow = true
      } catch {
        try {
          // Check for verify heading or verification code input
          const hasVerify = await page.locator(verifyHeadingSelector).first().isVisible().catch(() => false)
          const hasVerifyInput = await page.locator(verifyCodeInputSelector).first().isVisible().catch(() => false)
          if (hasVerify || hasVerifyInput) {
            isLoginFlow = true
            isVerifyFlow = true
          }
        } catch {
          isLoginFlow = false
        }
      }
    }
    
    if (isLoginFlow) {
      // ========== Login flow (email already registered) ==========
      if (isVerifyFlow) {
        log('\n⚠ Detected verification page, email already registered, proceeding directly to verification code step...')
      } else {
        log('\n⚠ Detected email already registered, switching to login flow...')
      }
      
      // If not direct verification flow, need to enter password first
      if (!isVerifyFlow) {
        // Step 2 (Login): Enter password
        log('\nStep 2 (Login): Entering password...')
        const loginPasswordSelector = 'input[placeholder="Enter password"]'
        if (!await waitAndFill(page, loginPasswordSelector, password, log, 'Login password input field')) {
          throw new Error('Login password input field not found')
        }
        
        await page.waitForTimeout(1000)
        
        // Click Continue button
        const loginContinueSelector = 'button[data-testid="test-primary-button"]'
        if (!await waitAndClickWithRetry(page, loginContinueSelector, log, 'Login Continue button')) {
          throw new Error('Failed to click login Continue button')
        }
        
        await page.waitForTimeout(3000)
      }
      
      // Step 3 (Login): Wait for verification code input field to appear, get and enter verification code
      log('\nStep 3 (Login): Getting and entering verification code...')
      // Login verification code input field selectors
      const loginCodeSelectors = [
        'input[placeholder="6-digit"]',
        'input[placeholder*="6"]',
        '[data-testid="email-verification-form-code-input"] input',
        'input[class*="awsui_input"][type="text"]'
      ]
      
      let loginCodeInput: string | null = null
      for (const selector of loginCodeSelectors) {
        try {
          await page.locator(selector).first().waitFor({ state: 'visible', timeout: 10000 })
          loginCodeInput = selector
          log('✓ Login verification code input field appeared')
          break
        } catch {
          continue
        }
      }
      
      if (!loginCodeInput) {
        throw new Error('Login verification code input field not found')
      }
      
      await page.waitForTimeout(1000)
      
      // Auto-get verification code (Graph API → open Outlook page → manual entry)
      let loginVerificationCode: string | null = null
      let manuallyEntered = false
      if (refreshToken && clientId) {
        loginVerificationCode = await getOutlookVerificationCode(refreshToken, clientId, log, 120)
      } else if (outlookPage) {
        log('Missing refresh_token / client_id → reading OTP from open Outlook tab')
        loginVerificationCode = await readOtpFromOutlookPage(outlookPage, log)
      }
      if (!loginVerificationCode) {
        log('→ Falling back to manual code entry')
        loginVerificationCode = await waitForManualCodeInput(page, loginCodeInput, log)
        manuallyEntered = true
      }

      if (!loginVerificationCode) {
        throw new Error('Failed to get login verification code')
      }

      // Only auto-fill if we obtained the code automatically.
      // If user entered it manually in the AWS tab, the input is already populated.
      if (!manuallyEntered) {
        if (!await waitAndFill(page, loginCodeInput, loginVerificationCode, log, 'Login verification code')) {
          throw new Error('Failed to enter login verification code')
        }
      }

      await page.waitForTimeout(1000)
      
      // Click verification code confirm button
      const loginVerifySelector = 'button[data-testid="test-primary-button"]'
      if (!await waitAndClickWithRetry(page, loginVerifySelector, log, 'Login verification code confirm button')) {
        throw new Error('Failed to click login verification code confirm button')
      }
      
      await page.waitForTimeout(5000)
      
    } else {
      // ========== Registration flow (new account) ==========
      // Step 2: Wait for name input field to appear, enter name
      log('\nStep 2: Entering name...')
      if (!await waitAndFill(page, nameInputSelector, randomName, log, 'Name input field')) {
        throw new Error('Name input field not found')
      }
      
      await page.waitForTimeout(1000)
      
      // Click second Continue button (with error detection and auto-retry)
      // Selector: button[data-testid="signup-next-button"]
      const secondContinueSelector = 'button[data-testid="signup-next-button"]'
      if (!await waitAndClickWithRetry(page, secondContinueSelector, log, 'Second Continue button')) {
        throw new Error('Failed to click second Continue button')
      }
      
      await page.waitForTimeout(3000)
      
      // Step 3: Wait for verification code input field to appear, get and enter verification code
      log('\nStep 3: Getting and entering verification code...')
      // Use a robust list of selectors plus form data-testid as fallback.
      const codeInputCandidates = [
        'input[placeholder="6-digit"]',
        'input[placeholder*="6"]',
        '[data-testid="email-verification-form-code-input"] input',
        'input[aria-labelledby*="formField"][type="text"]',
        'form#EmailVerification input[type="text"]'
      ]

      log('Waiting for verification code input field to appear...')
      let codeInputSelector: string | null = null
      for (const sel of codeInputCandidates) {
        try {
          await page.locator(sel).first().waitFor({ state: 'visible', timeout: 8000 })
          codeInputSelector = sel
          log(`✓ Verification code input field appeared (matched: ${sel})`)
          break
        } catch {
          continue
        }
      }
      if (!codeInputSelector) {
        throw new Error('Verification code input field not found')
      }

      await page.waitForTimeout(1000)
      
      // Auto-get verification code (Graph API → open Outlook page → manual entry)
      let verificationCode: string | null = null
      let manuallyEntered = false
      if (refreshToken && clientId) {
        verificationCode = await getOutlookVerificationCode(refreshToken, clientId, log, 120)
      } else if (outlookPage) {
        log('Missing refresh_token / client_id → reading OTP from open Outlook tab')
        verificationCode = await readOtpFromOutlookPage(outlookPage, log)
      }
      if (!verificationCode) {
        log('→ Falling back to manual code entry')
        verificationCode = await waitForManualCodeInput(page, codeInputSelector, log)
        manuallyEntered = true
      }

      if (!verificationCode) {
        throw new Error('Failed to get verification code')
      }

      // Only auto-fill if we obtained the code automatically.
      // If user entered it manually in the AWS tab, the input is already populated.
      if (!manuallyEntered) {
        if (!await waitAndFill(page, codeInputSelector, verificationCode, log, 'Verification code')) {
          throw new Error('Failed to enter verification code')
        }
      }

      await page.waitForTimeout(1000)
      
      // Click Continue button (with error detection and auto-retry)
      // Selector: button[data-testid="email-verification-verify-button"]
      const verifyButtonSelector = 'button[data-testid="email-verification-verify-button"]'
      if (!await waitAndClickWithRetry(page, verifyButtonSelector, log, 'Continue button')) {
        throw new Error('Failed to click Continue button')
      }
      
      await page.waitForTimeout(3000)
      
      // Step 4: Wait for password input field to appear, enter password
      log('\nStep 4: Entering password...')
      // Selector: input[placeholder="Enter password"]
      const passwordInputSelector = 'input[placeholder="Enter password"]'
      if (!await waitAndFill(page, passwordInputSelector, password, log, 'Password input field')) {
        throw new Error('Password input field not found')
      }
      
      await page.waitForTimeout(500)
      
      // Enter confirm password
      // Selector: input[placeholder="Re-enter password"]
      const confirmPasswordSelector = 'input[placeholder="Re-enter password"]'
      if (!await waitAndFill(page, confirmPasswordSelector, password, log, 'Confirm password input field')) {
        throw new Error('Confirm password input field not found')
      }
      
      await page.waitForTimeout(1000)
      
      // Click third Continue button (with error detection and auto-retry)
      // Selector: button[data-testid="test-primary-button"]
      const thirdContinueSelector = 'button[data-testid="test-primary-button"]'
      if (!await waitAndClickWithRetry(page, thirdContinueSelector, log, 'Third Continue button')) {
        throw new Error('Failed to click third Continue button')
      }
      
      await page.waitForTimeout(5000)
    }
    
    // Step 5: Get SSO Token (shared between login and registration flows)
    log('\nStep 5: Getting SSO Token...')
    let ssoToken: string | null = null
    
    for (let i = 0; i < 30; i++) {
      const cookies = await context.cookies()
      const ssoCookie = cookies.find(c => c.name === 'x-amz-sso_authn')
      if (ssoCookie) {
        ssoToken = ssoCookie.value
        log(`✓ Successfully obtained SSO Token (x-amz-sso_authn)!`)
        break
      }
      log(`Waiting for SSO Token... (${i + 1}/30)`)
      await page.waitForTimeout(1000)
    }
    
    await browser.close()
    browser = null

    if (keepOutlookOpen) {
      // Leave the Outlook browser open so the user can verify that the
      // verification email arrived (or read the code themselves if needed).
      // The user is responsible for closing it manually.
    } else if (outlookBrowser) {
      try { await outlookBrowser.close() } catch { /* ignore */ }
      outlookBrowser = null
      outlookPage = null
    }

    if (ssoToken) {
      log('\n========== Operation successful! ==========')
      return { success: true, ssoToken, name: randomName }
    } else {
      throw new Error('Failed to get SSO Token, operation may not be complete')
    }

  } catch (error) {
    log(`\n✗ Registration failed: ${error}`)
    if (browser) {
      try { await browser.close() } catch {}
    }
    if (outlookBrowser) {
      try { await outlookBrowser.close() } catch {}
    }
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
