/**
 * Screenshot script — launches the built Electron app via Playwright,
 * navigates to every page in the sidebar, and saves screenshots to
 * docs/screenshots/.
 *
 * Run: node scripts/take-screenshots.mjs
 */

import { _electron as electron } from 'playwright'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'docs', 'screenshots')
fs.mkdirSync(OUT_DIR, { recursive: true })

const PAGES = [
  { name: 'home',          label: 'Home',            navIndex: 0 },
  { name: 'accounts',      label: 'Account Manager', navIndex: 1 },
  { name: 'auto-register', label: 'Auto Register',   navIndex: 2 },
  { name: 'machine-id',    label: 'Machine ID',      navIndex: 3 },
  { name: 'kiro-settings', label: 'Kiro Settings',   navIndex: 4 },
  { name: 'settings',      label: 'Settings',        navIndex: 5 },
  { name: 'about',         label: 'About',           navIndex: 6 },
]

async function run() {
  console.log('Launching Electron app...')
  const app = await electron.launch({
    args: [path.join(ROOT, 'out', 'main', 'index.js')],
    cwd: ROOT,
  })

  const win = await app.firstWindow()
  await win.setViewportSize({ width: 1280, height: 800 })

  // Wait for app to fully load
  await win.waitForLoadState('domcontentloaded')
  await win.waitForTimeout(2500)

  // Nav items in the sidebar — by order of appearance
  const navSelectors = [
    // Try data-testid or aria-label first; fall back to nth-child
    'nav [data-page="home"], nav li:nth-child(1) button, aside button:nth-child(1)',
    'nav [data-page="accounts"], nav li:nth-child(2) button, aside button:nth-child(2)',
    'nav [data-page="machine-id"], nav li:nth-child(3) button, aside button:nth-child(3)',
    'nav [data-page="settings"], nav li:nth-child(4) button, aside button:nth-child(4)',
    'nav [data-page="about"], nav li:nth-child(5) button, aside button:nth-child(5)',
  ]

  for (let i = 0; i < PAGES.length; i++) {
    const { name, label } = PAGES[i]
    console.log(`  Capturing: ${label}`)

    // Try to click the nav item
    try {
      // Sidebar buttons — locate by position in the sidebar nav list
      const sidebarBtns = await win.locator('aside button, [role="navigation"] button, nav button').all()
      if (sidebarBtns[i]) {
        await sidebarBtns[i].click()
        await win.waitForTimeout(800)
      }
    } catch (e) {
      console.warn(`    Could not click nav item ${i}: ${e.message}`)
    }

    // Scroll to top before capturing
    await win.evaluate(() => window.scrollTo(0, 0))
    await win.waitForTimeout(300)

    const outPath = path.join(OUT_DIR, `${name}.png`)
    await win.screenshot({ path: outPath, type: 'png' })
    console.log(`  ✓ Saved ${outPath}`)
  }

  await app.close()
  console.log('\nAll screenshots saved to docs/screenshots/')
}

run().catch((err) => {
  console.error('Screenshot script failed:', err)
  process.exit(1)
})
