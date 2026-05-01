/**
 * Translation utility for Electron main process
 * Provides i18n translations without requiring React
 */

const enTranslations = {
    'auto_register.imported': 'Imported',
    'auto_register.email_accounts': 'email accounts',
    'auto_register.starting_batch_registration': 'Starting batch registration',
    'auto_register.concurrency': 'concurrency',
    'auto_register.pending': 'Pending',
    'auto_register.skipped': 'Skipped',
    'auto_register.starting_registration': 'Starting registration...',
    'auto_register.outlook_detected': 'Detected Outlook email, activating first (without proxy)...',
    'auto_register.outlook_activation_started': 'Starting Outlook email activation',
    'auto_register.email': 'Email',
    'auto_register.step_1_launch_browser': 'Step 1: Launching browser, accessing Outlook activation page...',
    'auto_register.outlook_activation_failed': 'Outlook activation failed',
    'auto_register.outlook_activation_warning': 'Outlook activation may not be complete',
    'auto_register.continuing_aws_registration': 'Continuing AWS registration...',
    'auto_register.aws_builder_id_registration': 'Starting AWS Builder ID registration',
    'auto_register.registration_failed': 'Registration failed',
    'auto_register.registration_complete': 'Registration complete',
    'auto_register.success': 'success',
    'auto_register.failed': 'failed',
    'auto_register.name': 'Name',
    'auto_register.password': 'Password',
    'auto_register.step_2_launch_browser': 'Step 2: Launching browser, entering registration page...',
    'auto_register.page_loaded': 'Page loaded successfully',
    'auto_register.step_2_input_email': 'Step 2: Entering email...',
    'auto_register.email_entered': 'Email entered',
    'auto_register.step_3_click_next': 'Step 3: Clicking next button...',
    'auto_register.first_next_clicked': 'First next button clicked',
    'auto_register.step_4_input_password': 'Step 4: Entering password...',
    'auto_register.password_entered': 'Password entered',
    'auto_register.step_5_click_login': 'Step 5: Clicking login button...',
    'auto_register.login_clicked': 'Login button clicked',
    'auto_register.step_6_click_skip': 'Step 6: Clicking first skip link...',
    'auto_register.first_skip_clicked': 'First skip clicked',
    'auto_register.step_7_click_second_skip': 'Step 7: Clicking second skip link...',
    'auto_register.second_skip_not_found': 'Second skip link not found, may have skipped this step',
    'auto_register.step_8_cancel_key_creation': 'Step 8: Clicking cancel button (skip key creation)...',
    'auto_register.registration_success': 'Registration successful',
    'auto_register.registration_error': 'Registration error'
}

const zhTranslations = {
  'auto_register.imported': '已导入',
  'auto_register.email_accounts': '个邮箱账号',
  'auto_register.starting_batch_registration': '开始批量注册',
  'auto_register.concurrency': '并发数',
  'auto_register.pending': '待处理',
  'auto_register.skipped': '已跳过',
  'auto_register.starting_registration': '开始注册...',
  'auto_register.outlook_detected': '检测到 Outlook 邮箱，先进行激活（不使用代理）...',
  'auto_register.outlook_activation_started': '开始激活 Outlook 邮箱',
  'auto_register.email': '邮箱',
  'auto_register.step_1_launch_browser': '步骤1: 启动浏览器，访问 Outlook 激活页面...',
  'auto_register.outlook_activation_failed': 'Outlook 激活失败',
  'auto_register.outlook_activation_warning': 'Outlook 激活可能未完成',
  'auto_register.continuing_aws_registration': '继续尝试 AWS 注册...',
  'auto_register.aws_builder_id_registration': '开始 AWS Builder ID 注册',
  'auto_register.registration_failed': '注册失败',
  'auto_register.registration_complete': '注册完成',
  'auto_register.success': '成功',
  'auto_register.failed': '失败',
  'auto_register.name': '姓名',
  'auto_register.password': '密码',
  'auto_register.step_2_launch_browser': '步骤2: 启动浏览器，进入注册页面...',
  'auto_register.page_loaded': '页面加载完成',
  'auto_register.step_2_input_email': '步骤2: 输入邮箱...',
  'auto_register.email_entered': '已输入邮箱',
  'auto_register.step_3_click_next': '步骤3: 点击下一步按钮...',
  'auto_register.first_next_clicked': '已点击第一个下一步按钮',
  'auto_register.step_4_input_password': '步骤4: 输入密码...',
  'auto_register.password_entered': '已输入密码',
  'auto_register.step_5_click_login': '步骤5: 点击登录按钮...',
  'auto_register.login_clicked': '已点击登录按钮',
  'auto_register.step_6_click_skip': '步骤6: 点击第一个"暂时跳过"链接...',
  'auto_register.first_skip_clicked': '已点击第一个"暂时跳过"',
  'auto_register.step_7_click_second_skip': '步骤7: 点击第二个"暂时跳过"链接...',
  'auto_register.second_skip_not_found': '未找到第二个"暂时跳过"链接，可能已跳过此步骤',
  'auto_register.step_8_cancel_key_creation': '步骤8: 点击"取消"按钮（跳过密钥创建）...',
  'auto_register.registration_success': '注册成功',
  'auto_register.registration_error': '注册错误'
}

const translations = {
  en: enTranslations,
  zh: zhTranslations
}

let currentLanguage: 'en' | 'zh' = 'en'

export function setLanguage(lang: 'en' | 'zh') {
  currentLanguage = lang
}

export function getLanguage() {
  return currentLanguage
}

export function t(key: string, params?: Record<string, string | number>): string {
  const langTranslations = translations[currentLanguage] as Record<string, string>
  let text = langTranslations[key] || key
  
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{{${k}}}`, String(v))
    })
  }
  
  return text
}
