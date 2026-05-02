/**
 * Bulk Outlook / Microsoft Account Password Change Module
 * Uses Playwright to navigate to account.live.com/password/change,
 * login with the current credentials, and set a new password.
 * OTP verification is handled the same way as Auto Register:
 *   - Graph API (refresh_token + client_id)  → automatic
 *   - No credentials                         → wait for Microsoft to skip / fail-fast
 */

import { chromium, Browser, Page } from 'playwright'
import { getOutlookVerificationCode } from './autoRegister'

type LogCallback = (message: string) => void

async function tryClickSelectors(
  page: Page,
  selectors: string[],
  log: LogCallback,
  description: string,
  timeout = 10000
): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first()
      await element.waitFor({ state: 'visible', timeout })
      await element.click()
      log(`✓ Clicked ${description}`)
      return true
    } catch {
      continue
    }
  }
  return false
}

async function fillInput(
  page: Page,
  selectors: string[],
  value: string,
  log: LogCallback,
  description: string,
  timeout = 15000
): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first()
      await element.waitFor({ state: 'visible', timeout })
      await element.fill(value)
      log(`✓ Filled ${description}`)
      return true
    } catch {
      continue
    }
  }
  return false
}

/**
 * Change the password of a Microsoft / Outlook account.
 *
 * @param email         Microsoft account email
 * @param oldPassword   Current password
 * @param newPassword   Desired new password
 * @param refreshToken  Microsoft Graph refresh token (optional, for OTP auto-read)
 * @param clientId      Microsoft Graph client ID (optional, for OTP auto-read)
 * @param log           Log callback streamed back to renderer
 * @param proxyUrl      Optional HTTP proxy
 */
export async function changeOutlookPassword(
  email: string,
  oldPassword: string,
  newPassword: string,
  refreshToken: string,
  clientId: string,
  log: LogCallback,
  proxyUrl?: string
): Promise<{ success: boolean; newPassword?: string; error?: string }> {
  let browser: Browser | null = null

  log('========== Starting Microsoft Account Password Change ==========')
  log(`Email: ${email}`)

  const hasGraphCredentials = !!(refreshToken && clientId)
  if (!hasGraphCredentials) {
    log('⚠ No Graph credentials supplied — OTP auto-read disabled. If Microsoft requires verification, the process will fail.')
  }

  try {
    log('\nStep 1: Launch browser...')
    browser = await chromium.launch({
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        ...(proxyUrl ? [`--proxy-server=${proxyUrl}`] : [])
      ]
    })

    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })

    const page = await context.newPage()

    // Step 2: Navigate to Microsoft password-change page
    log('\nStep 2: Navigate to Microsoft password change page...')
    await page.goto('https://account.live.com/password/change', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    })
    await page.waitForTimeout(2000)
    log('✓ Page loaded')

    // Step 3: Enter email if login form appears
    log('\nStep 3: Enter email...')
    const emailFilled = await fillInput(
      page,
      [
        'input#i0116[type="email"]',
        'input[name="loginfmt"]',
        'input[type="email"]'
      ],
      email,
      log,
      'email',
      12000
    )

    if (!emailFilled) {
      // Maybe already signed in — check if change-password form is visible
      const pwdFormVisible = await page
        .locator('input[name="OldPassword"], input[name="oldPassword"], input[id*="oldPassword" i]')
        .first()
        .isVisible()
        .catch(() => false)

      if (!pwdFormVisible) {
        throw new Error('Email input not found and password-change form not visible')
      }
      log('ℹ Email input not found — already signed in, skipping login steps')
    } else {
      await page.waitForTimeout(800)

      // Step 4: Click Next
      log('\nStep 4: Click Next...')
      if (
        !await tryClickSelectors(
          page,
          ['input#idSIButton9[type="submit"]', 'input[type="submit"][value="Next"]', 'button[type="submit"]'],
          log,
          'Next button'
        )
      ) {
        throw new Error('Could not click Next button after email entry')
      }
      await page.waitForTimeout(3000)

      // Step 5: Enter password
      log('\nStep 5: Enter current password...')
      const pwdFilled = await fillInput(
        page,
        [
          'input#passwordEntry[type="password"]',
          'input#i0118[type="password"]',
          'input[name="passwd"][type="password"]',
          'input[type="password"]'
        ],
        oldPassword,
        log,
        'password',
        15000
      )
      if (!pwdFilled) {
        throw new Error('Password input not found')
      }
      await page.waitForTimeout(800)

      // Step 6: Click Sign in
      log('\nStep 6: Click Sign in...')
      if (
        !await tryClickSelectors(
          page,
          [
            'button[type="submit"][data-testid="primaryButton"]',
            'input#idSIButton9[type="submit"]',
            'button:has-text("Sign in")',
            'button:has-text("Next")'
          ],
          log,
          'Sign in button'
        )
      ) {
        throw new Error('Could not click Sign in button')
      }
      await page.waitForTimeout(4000)

      // Step 7: Handle "Stay signed in?" prompt
      log('\nStep 7: Handle stay-signed-in prompt...')
      const staySignedInClicked = await tryClickSelectors(
        page,
        [
          'button[type="submit"][data-testid="primaryButton"]:has-text("Yes")',
          'input#idSIButton9[value="Yes"]',
          'button:has-text("Yes")'
        ],
        log,
        '"Yes" / stay signed in button',
        5000
      )
      if (!staySignedInClicked) {
        log('ℹ No stay-signed-in prompt — continuing')
      }
      await page.waitForTimeout(3000)

      // Check for incorrect password error
      const errorVisible = await page
        .locator('[id*="error" i], [class*="error" i], [data-testid*="error" i]')
        .first()
        .isVisible()
        .catch(() => false)
      if (errorVisible) {
        const errorText = await page
          .locator('[id*="error" i], [class*="error" i], [data-testid*="error" i]')
          .first()
          .innerText()
          .catch(() => 'Unknown login error')
        throw new Error(`Login failed: ${errorText.trim()}`)
      }
    }

    // Step 8: Navigate to password change page (post-login)
    log('\nStep 8: Navigate to password change form...')
    const currentUrl = page.url()
    if (!currentUrl.includes('password/change') && !currentUrl.includes('changepassword')) {
      await page.goto('https://account.live.com/password/change', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      })
      await page.waitForTimeout(3000)
    }
    log(`✓ Current URL: ${page.url()}`)

    // Step 9: Fill old password in change-password form
    log('\nStep 9: Fill old password in change-password form...')
    const oldPwdFilled = await fillInput(
      page,
      [
        'input[name="OldPassword"]',
        'input[name="oldPassword"]',
        'input[id*="oldPassword" i]',
        'input[placeholder*="Current password" i]',
        'input[placeholder*="old password" i]'
      ],
      oldPassword,
      log,
      'old password field'
    )
    if (!oldPwdFilled) {
      throw new Error('Old password field not found in change-password form')
    }
    await page.waitForTimeout(500)

    // Step 10: Fill new password
    log('\nStep 10: Fill new password...')
    const newPwdFilled = await fillInput(
      page,
      [
        'input[name="NewPassword"]',
        'input[name="newPassword"]',
        'input[id*="newPassword" i]',
        'input[placeholder*="New password" i]'
      ],
      newPassword,
      log,
      'new password field'
    )
    if (!newPwdFilled) {
      throw new Error('New password field not found')
    }
    await page.waitForTimeout(500)

    // Step 11: Confirm new password
    log('\nStep 11: Confirm new password...')
    const confirmFilled = await fillInput(
      page,
      [
        'input[name="ConfirmNewPassword"]',
        'input[name="confirmNewPassword"]',
        'input[id*="confirmPassword" i]',
        'input[placeholder*="Confirm" i]'
      ],
      newPassword,
      log,
      'confirm password field'
    )
    if (!confirmFilled) {
      throw new Error('Confirm password field not found')
    }
    await page.waitForTimeout(500)

    // Step 12: Submit
    log('\nStep 12: Submit password change...')
    if (
      !await tryClickSelectors(
        page,
        [
          'input[type="submit"][value="Save"]',
          'button[type="submit"]:has-text("Save")',
          'input[type="submit"]',
          'button[type="submit"]'
        ],
        log,
        'Save button'
      )
    ) {
      throw new Error('Could not click Save button')
    }
    await page.waitForTimeout(5000)

    // Step 13: Handle verification challenge (two-phase)
    //
    // Phase A — Microsoft shows a "choose verification method" screen before the OTP input.
    //   Typical elements: a link/button to send a code to the backup/alternate email.
    //   We select the email option, click "Send code", then fall through to Phase B.
    //
    // Phase B — OTP input is visible; read the code via Graph API and fill it in.

    log('\nStep 13: Check for verification challenge...')

    // Phase A: detect the verification-method selection page
    const emailVerifySelectors = [
      '#idA_SAATC_SendEmail',          // classic Microsoft account
      'a[id*="SendEmail" i]',
      '[data-value="Email"]',
      'a[aria-label*="email" i]',
      'a:has-text("email")',
      'div[id*="email" i] a',
      // live.com alternate flow
      '#iSelectProofOption_1',
      'label[for*="email" i]'
    ]

    let triggeredEmailSend = false

    for (const sel of emailVerifySelectors) {
      try {
        const el = page.locator(sel).first()
        const visible = await el.isVisible({ timeout: 3000 }).catch(() => false)
        if (!visible) continue

        log(`Detected verification-method selection — choosing email option (${sel})...`)

        if (!hasGraphCredentials) {
          throw new Error(
            'Microsoft requires backup-email verification but no Graph credentials (refresh_token + client_id) were provided. ' +
            'Add them to the account line: email|password|refresh_token|client_id'
          )
        }

        await el.click()
        log('✓ Selected email verification option')
        await page.waitForTimeout(1500)

        // Click "Send code" / "Next" to trigger the email
        const sendClicked = await tryClickSelectors(
          page,
          [
            'input#idSIButton9',
            'input[value="Send code"]',
            'input[value="Send Code"]',
            'button:has-text("Send code")',
            'button:has-text("Send")',
            'input[type="submit"]',
            'button[type="submit"]'
          ],
          log,
          '"Send code" button',
          8000
        )

        if (!sendClicked) {
          log('⚠ Could not click "Send code" — the email option might have triggered send automatically')
        }

        triggeredEmailSend = true
        await page.waitForTimeout(4000)
        break
      } catch (err) {
        if ((err as Error).message?.includes('Graph credentials')) throw err
        continue
      }
    }

    // Phase B: OTP input (appears directly, or after Phase A triggered the email send)
    const otpSelectors = [
      'input[name="otc"]',
      'input[id*="otc" i]',
      'input[placeholder*="code" i]',
      'input[autocomplete="one-time-code"]',
      'input[type="tel"]'       // Microsoft sometimes uses tel for OTP digits
    ]

    const otpInputVisible = await (async () => {
      for (const sel of otpSelectors) {
        try {
          const visible = await page.locator(sel).first().isVisible({ timeout: 2000 })
          if (visible) return true
        } catch {
          // continue
        }
      }
      return false
    })()

    if (otpInputVisible || triggeredEmailSend) {
      log(
        triggeredEmailSend
          ? 'Backup-email verification code sent — fetching via Graph API...'
          : 'OTP input detected — fetching code via Graph API...'
      )

      if (!hasGraphCredentials) {
        throw new Error(
          'Microsoft requires OTP verification but no Graph credentials (refresh_token + client_id) were provided. ' +
          'Add them to the account line: email|password|refresh_token|client_id'
        )
      }

      // If we triggered an email send, give the server a moment to deliver before polling
      if (triggeredEmailSend) {
        log('Waiting a few seconds for delivery before polling mailbox...')
        await page.waitForTimeout(5000)
      }

      log('Fetching code from mailbox via Graph API (timeout: 120s)...')
      const otp = await getOutlookVerificationCode(refreshToken, clientId, log, 120)

      if (!otp) {
        throw new Error('Could not retrieve verification code from mailbox (timed out or no matching email)')
      }

      log(`✓ Code received: ${otp}`)

      // Wait for OTP field if Phase A just triggered the email delivery screen
      if (triggeredEmailSend) {
        await page.waitForTimeout(2000)
      }

      const filled = await fillInput(
        page,
        otpSelectors,
        otp,
        log,
        'OTP / verification code field'
      )

      if (!filled) {
        throw new Error('Could not find OTP input field to fill the code')
      }

      await page.waitForTimeout(800)

      if (
        !await tryClickSelectors(
          page,
          [
            'input[type="submit"]',
            'button[type="submit"]',
            'button[data-testid="primaryButton"]'
          ],
          log,
          'OTP submit button'
        )
      ) {
        throw new Error('Could not submit verification code')
      }

      await page.waitForTimeout(5000)
    } else {
      log('ℹ No verification challenge detected')
    }

    // Step 14: Verify success
    log('\nStep 14: Verifying success...')
    const finalUrl = page.url()
    log(`Final URL: ${finalUrl}`)

    // Look for error indicators
    const errorAfterSubmit = await page
      .locator('[id*="error" i]:visible, [class*="error" i]:visible, .alert-danger:visible')
      .first()
      .isVisible()
      .catch(() => false)

    if (errorAfterSubmit) {
      const errorText = await page
        .locator('[id*="error" i]:visible, [class*="error" i]:visible, .alert-danger:visible')
        .first()
        .innerText()
        .catch(() => 'Unknown error')
      throw new Error(`Password change failed: ${errorText.trim()}`)
    }

    // Look for success indicators
    const successIndicators = [
      finalUrl.includes('success'),
      finalUrl.includes('account.microsoft.com'),
      finalUrl.includes('account.live.com') && !finalUrl.includes('password/change'),
      await page.locator('text=/password.*changed/i, text=/successfully/i').first().isVisible().catch(() => false)
    ]

    if (!successIndicators.some(Boolean)) {
      log('⚠ Could not confirm success from URL or page content — assuming success if no error was shown')
    } else {
      log('✓ Password changed successfully!')
    }

    return { success: true, newPassword }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log(`✗ Error: ${message}`)
    return { success: false, error: message }
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined)
      log('Browser closed.')
    }
    log('========== Password Change Process Complete ==========')
  }
}
