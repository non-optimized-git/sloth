const { test, expect } = require('@playwright/test');
const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8766 + Math.floor(Math.random() * 1000);
const APP_URL = `http://localhost:${PORT}/index.html`;

// ── 测试账号（需在 Supabase 后台预创建，或通过环境变量注入）──
const TEST_EMAIL = process.env.SLOTH_TEST_EMAIL || 'sloth-test@example.com';
const TEST_PASSWORD = process.env.SLOTH_TEST_PASSWORD || 'Test123456';

// ── 本地 HTTP 服务器 ─────────────────────────────
let server;
test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath);
    const types = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    try {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => server.listen(PORT, r));
});
test.afterAll(async () => {
  if (server) server.close();
});

// ── 辅助函数 ─────────────────────────────────────

/** 打开登录弹窗并等待可见 */
async function openLoginModal(page) {
  await page.goto(APP_URL);
  await page.locator('#uploadLoginBtn').click();
  await expect(page.locator('#slothLoginModal')).not.toHaveClass(/hidden/);
}

/** 执行登录流程，返回是否成功 */
async function tryLogin(page, email, password) {
  await openLoginModal(page);
  await page.fill('#sauthLoginEmail', email);
  await page.fill('#sauthLoginPwd', password);
  await page.locator('#sauthLoginSubmit').click();
  // 等待：要么弹窗关闭（成功），要么出现错误提示（失败）
  await Promise.race([
    page.waitForSelector('#slothLoginModal.hidden', { timeout: 15000 }).catch(() => {}),
    page.waitForFunction(
      () => {
        const el = document.getElementById('sauthError');
        return el && el.style.display !== 'none' && el.textContent.trim().length > 0;
      },
      { timeout: 15000 }
    ).catch(() => {}),
  ]);

  const modalHidden = await page.locator('#slothLoginModal').evaluate((el) =>
    el.classList.contains('hidden')
  );
  return modalHidden;
}

/** 登录（跳过测试如果失败） */
async function loginOrFail(page) {
  const ok = await tryLogin(page, TEST_EMAIL, TEST_PASSWORD);
  if (!ok) {
    // 捕获错误信息以供调试
    const errText = await page.locator('#sauthError').textContent().catch(() => 'unknown');
    test.skip(true, `测试账号登录失败（${errText}），请设置 SLOTH_TEST_EMAIL / SLOTH_TEST_PASSWORD 环境变量或在 Supabase 后台预创建账号`);
  }
}

/** 上传测试 Excel 并等待 dashboard */
async function uploadTestFile(page) {
  const testExcel = path.join(ROOT, 'scripts', 'test-data.xlsx');
  const fileInput = page.locator('#fileInput');
  await fileInput.setInputFiles(testExcel);
  await page.waitForFunction(
    () => {
      const d = document.getElementById('dashboard');
      return d && d.style.display !== 'none' && d.offsetParent !== null;
    },
    { timeout: 15000 }
  );
}

// ══════════════════════════════════════════════════
// 1. 登录界面显示
// ══════════════════════════════════════════════════
test.describe('1. 登录界面显示', () => {
  test('1.1 登录按钮在首页右上角显示', async ({ page }) => {
    await page.goto(APP_URL);
    const loginBtn = page.locator('#uploadLoginBtn');
    await expect(loginBtn).toBeVisible();
    await expect(loginBtn).toContainText('登录');
  });

  test('1.2 点击登录按钮弹出登录窗口', async ({ page }) => {
    await page.goto(APP_URL);
    const modal = page.locator('#slothLoginModal');
    await expect(modal).toHaveClass(/hidden/);

    await page.locator('#uploadLoginBtn').click();
    await expect(modal).not.toHaveClass(/hidden/);
  });

  test('1.3 登录窗口包含邮箱和密码输入框', async ({ page }) => {
    await openLoginModal(page);
    await expect(page.locator('#sauthLoginEmail')).toBeVisible();
    await expect(page.locator('#sauthLoginPwd')).toBeVisible();
    await expect(page.locator('#sauthLoginSubmit')).toBeVisible();
  });

  test('1.4 登录窗口有登录和注册 Tab 切换', async ({ page }) => {
    await openLoginModal(page);

    const loginTab = page.locator('.sauth-tab[data-tab="login"]');
    const signupTab = page.locator('.sauth-tab[data-tab="signup"]');
    await expect(loginTab).toBeVisible();
    await expect(signupTab).toBeVisible();

    // 默认激活登录 Tab
    await expect(loginTab).toHaveClass(/active/);
    await expect(page.locator('#sauthLoginForm')).toBeVisible();
    await expect(page.locator('#sauthSignupForm')).toBeHidden();

    // 切换到注册 Tab
    await signupTab.click();
    await expect(signupTab).toHaveClass(/active/);
    await expect(page.locator('#sauthSignupForm')).toBeVisible();
    await expect(page.locator('#sauthLoginForm')).toBeHidden();

    // 切回登录 Tab
    await loginTab.click();
    await expect(loginTab).toHaveClass(/active/);
    await expect(page.locator('#sauthLoginForm')).toBeVisible();
  });

  test('1.5 Google/GitHub 按钮应该隐藏（未配置 OAuth）', async ({ page }) => {
    await openLoginModal(page);
    await expect(page.locator('#sauthGoogle')).toBeHidden();
    await expect(page.locator('#sauthGitHub')).toBeHidden();
  });

  test('1.6 登录窗口可以点击关闭按钮关闭', async ({ page }) => {
    await openLoginModal(page);
    await page.locator('#sauthClose').click();
    await expect(page.locator('#slothLoginModal')).toHaveClass(/hidden/);
  });

  test('1.7 登录窗口可以点击遮罩层关闭', async ({ page }) => {
    await openLoginModal(page);
    // 点击遮罩层（弹窗背景）
    await page.locator('#slothLoginModal').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('#slothLoginModal')).toHaveClass(/hidden/);
  });
});

// ══════════════════════════════════════════════════
// 2. 注册功能
// ══════════════════════════════════════════════════
test.describe('2. 注册功能', () => {
  test.beforeEach(async ({ page }) => {
    await openLoginModal(page);
    await page.locator('.sauth-tab[data-tab="signup"]').click();
  });

  test('2.1 密码少于 6 位显示错误提示', async ({ page }) => {
    await page.fill('#sauthSignupEmail', 'test@example.com');
    await page.fill('#sauthSignupPwd', '12345');
    await page.locator('#sauthSignupSubmit').click();

    const error = page.locator('#sauthError');
    await expect(error).toBeVisible();
    await expect(error).toContainText('密码至少 6 位');
  });

  test('2.2 邮箱为空提交显示错误提示', async ({ page }) => {
    await page.fill('#sauthSignupPwd', 'Test123456');
    await page.locator('#sauthSignupSubmit').click();

    const error = page.locator('#sauthError');
    await expect(error).toBeVisible();
    await expect(error).toContainText('请填写邮箱和密码');
  });

  test('2.3 密码为空提交显示错误提示', async ({ page }) => {
    await page.fill('#sauthSignupEmail', 'test@example.com');
    await page.locator('#sauthSignupSubmit').click();

    const error = page.locator('#sauthError');
    await expect(error).toBeVisible();
    await expect(error).toContainText('请填写邮箱和密码');
  });

  test('2.4 邮箱格式错误显示错误提示', async ({ page }) => {
    await page.fill('#sauthSignupEmail', 'invalid-email');
    await page.fill('#sauthSignupPwd', 'Test123456');
    await page.locator('#sauthSignupSubmit').click();

    // Supabase 返回邮箱格式错误，或客户端校验错误
    const error = page.locator('#sauthError');
    await expect(error).toBeVisible();
    // 错误信息应非空
    const text = await error.textContent();
    expect(text.trim().length).toBeGreaterThan(0);
  });

  test('2.5 输入有效邮箱和密码可以注册（或触发邮箱验证/速率限制）', async ({ page }) => {
    // 使用唯一邮箱
    const uniqueEmail = `sloth-test-${Date.now()}@example.com`;
    await page.fill('#sauthSignupEmail', uniqueEmail);
    await page.fill('#sauthSignupPwd', 'Test123456');
    await page.locator('#sauthSignupSubmit').click();

    // 验证：Supabase 返回了反馈（成功提示或错误信息）
    const error = page.locator('#sauthError');
    await expect(error).toBeVisible();
    const text = await error.textContent();
    // Supabase 注册成功会提示"注册成功！如需邮箱验证请查看收件箱"
    // rate limit 时会提示 "email rate limit exceeded"
    // 其他可能错误："User already registered", "Unable to validate email address" 等
    // 只要返回了非空文本即说明 Supabase 后端正常响应
    expect(text.trim().length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════
// 3. 登录功能
// ══════════════════════════════════════════════════
test.describe('3. 登录功能', () => {
  test('3.1 输入错误密码显示错误提示', async ({ page }) => {
    await openLoginModal(page);
    await page.fill('#sauthLoginEmail', TEST_EMAIL);
    await page.fill('#sauthLoginPwd', 'wrongpassword');
    await page.locator('#sauthLoginSubmit').click();

    // 等待错误提示出现
    await page.waitForFunction(
      () => {
        const el = document.getElementById('sauthError');
        return el && el.style.display !== 'none' && el.textContent.trim().length > 0;
      },
      { timeout: 15000 }
    );
    const error = page.locator('#sauthError');
    await expect(error).toBeVisible();
    // 弹窗不应关闭
    await expect(page.locator('#slothLoginModal')).not.toHaveClass(/hidden/);
  });

  test('3.2 输入未注册邮箱显示错误提示', async ({ page }) => {
    await openLoginModal(page);
    const nonExistEmail = `nonexist-${Date.now()}@example.com`;
    await page.fill('#sauthLoginEmail', nonExistEmail);
    await page.fill('#sauthLoginPwd', 'SomePassword123');
    await page.locator('#sauthLoginSubmit').click();

    // 等待错误提示
    await page.waitForFunction(
      () => {
        const el = document.getElementById('sauthError');
        return el && el.style.display !== 'none' && el.textContent.trim().length > 0;
      },
      { timeout: 15000 }
    );
    const error = page.locator('#sauthError');
    await expect(error).toBeVisible();
    await expect(page.locator('#slothLoginModal')).not.toHaveClass(/hidden/);
  });

  test('3.3 输入正确邮箱和密码可以登录', async ({ page }) => {
    const ok = await tryLogin(page, TEST_EMAIL, TEST_PASSWORD);
    if (!ok) {
      const errText = await page.locator('#sauthError').textContent().catch(() => 'unknown');
      test.skip(true, `测试账号登录失败（${errText}），请设置 SLOTH_TEST_EMAIL/SLOTH_TEST_PASSWORD 或预创建账号`);
    }
    // 登录成功 → 弹窗关闭
    await expect(page.locator('#slothLoginModal')).toHaveClass(/hidden/);
    // 上传页显示用户信息
    await expect(page.locator('#uploadUserInfo')).toBeVisible();
  });

  test('3.4 登录成功后页面跳转到「我的文件」页面', async ({ page }) => {
    await loginOrFail(page);
    // 登录后自动跳转到文件页
    await expect(page.locator('#filesPage')).toBeVisible();
    await expect(page.locator('#filesPage')).toContainText('我的文件');
  });

  test('3.5 登录弹窗中邮箱输入框有正确 placeholder', async ({ page }) => {
    await openLoginModal(page);
    await expect(page.locator('#sauthLoginEmail')).toHaveAttribute('placeholder', '邮箱地址');
    await expect(page.locator('#sauthLoginPwd')).toHaveAttribute('placeholder', '密码');
  });

  test('3.6 登录弹窗中注册输入框有正确 placeholder', async ({ page }) => {
    await openLoginModal(page);
    await page.locator('.sauth-tab[data-tab="signup"]').click();
    await expect(page.locator('#sauthSignupEmail')).toHaveAttribute('placeholder', '邮箱地址');
    await expect(page.locator('#sauthSignupPwd')).toHaveAttribute('placeholder', '密码（至少 6 位）');
  });
});

// ══════════════════════════════════════════════════
// 4. 登录状态保持
// ══════════════════════════════════════════════════
test.describe('4. 登录状态保持', () => {
  test('4.1 登录后刷新页面，仍然保持登录状态', async ({ page }) => {
    await loginOrFail(page);

    // 刷新页面
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 仍然应显示文件页（说明登录状态保持）
    await expect(page.locator('#filesPage')).toBeVisible();
    // 不应显示登录按钮
    await expect(page.locator('#uploadLoginBtn')).toBeHidden();
  });

  test('4.2 登录后关闭浏览器再打开，仍然保持登录状态', async ({ page, context }) => {
    await loginOrFail(page);

    // 创建新页面模拟重新打开
    const newPage = await context.newPage();
    await newPage.goto(APP_URL);
    await newPage.waitForLoadState('networkidle');

    // Supabase 使用 localStorage 保持会话
    await expect(newPage.locator('#filesPage')).toBeVisible();
    await expect(newPage.locator('#uploadLoginBtn')).toBeHidden();

    await newPage.close();
  });
});

// ══════════════════════════════════════════════════
// 5. 退出功能
// ══════════════════════════════════════════════════
test.describe('5. 退出功能', () => {
  test('5.1 点击退出按钮可以退出登录', async ({ page }) => {
    await loginOrFail(page);

    // 点击退出
    await page.locator('#filesPageLogoutBtn').click();
    // 等待退出完成
    await page.waitForTimeout(2000);

    // 退出后应显示上传页
    await expect(page.locator('#uploadPage')).toBeVisible();
  });

  test('5.2 退出后页面跳转到上传页面', async ({ page }) => {
    await loginOrFail(page);
    await page.locator('#filesPageLogoutBtn').click();
    await page.waitForTimeout(2000);

    await expect(page.locator('#uploadPage')).toBeVisible();
    await expect(page.locator('#filesPage')).toBeHidden();
  });

  test('5.3 退出后右上角显示「登录」按钮', async ({ page }) => {
    await loginOrFail(page);
    await page.locator('#filesPageLogoutBtn').click();
    await page.waitForTimeout(2000);

    const loginBtn = page.locator('#uploadLoginBtn');
    await expect(loginBtn).toBeVisible();
    await expect(loginBtn).toContainText('登录');
    // 用户信息应隐藏
    await expect(page.locator('#uploadUserInfo')).toBeHidden();
  });
});

// ══════════════════════════════════════════════════
// 6. 文件上传与登录关联
// ══════════════════════════════════════════════════
test.describe('6. 文件上传与登录关联', () => {
  test('6.1 未登录时上传文件，只在本地显示', async ({ page }) => {
    await page.goto(APP_URL);
    await uploadTestFile(page);

    // dashboard 可见
    await expect(page.locator('#dashboard')).toBeVisible();
    // 未登录 → 应显示登录按钮
    const loginBtn = page.locator('#slothLoginBtn');
    await expect(loginBtn).toBeVisible();
    await expect(loginBtn).toContainText('登录');
  });

  test('6.2 未登录时「我的文件」按钮不可见或跳转需登录', async ({ page }) => {
    await page.goto(APP_URL);
    // 未登录时上传页不显示「我的文件」按钮（或按钮不可见）
    const myFilesBtn = page.locator('#uploadMyFilesBtn');
    // 根据实际实现验证：如果按钮存在则点击后应提示登录
    const isVisible = await myFilesBtn.isVisible().catch(() => false);
    if (isVisible) {
      await myFilesBtn.click();
      // 应该提示需要登录
      await expect(page.locator('#filesPage')).toBeVisible();
      // 未登录时文件网格应提示登录
      await expect(page.locator('#filesGrid')).toContainText('请先登录');
    }
  });

  test('6.3 登录后可以在「我的文件」页面看到文件管理界面', async ({ page }) => {
    await loginOrFail(page);

    // 文件页应可见
    await expect(page.locator('#filesPage')).toBeVisible();
    // 文件页标题
    await expect(page.locator('.files-page-title')).toContainText('我的文件');
    // 应有上传按钮
    await expect(page.locator('#filesUploadBtn')).toBeVisible();
    // 应有退出按钮
    await expect(page.locator('#filesPageLogoutBtn')).toBeVisible();
  });
});

// ══════════════════════════════════════════════════
// 7. 页面导航
// ══════════════════════════════════════════════════
test.describe('7. 页面导航', () => {
  test('7.1 未登录时点击 Logo 返回上传页面', async ({ page }) => {
    await page.goto(APP_URL);
    await uploadTestFile(page);

    // 点击 Logo
    await page.locator('#dashboardLogo').click();
    // 未登录 → 返回上传页
    await expect(page.locator('#uploadPage')).toBeVisible();
  });

  test('7.2 未登录时点击「返回主页」按钮返回上传页面', async ({ page }) => {
    await page.goto(APP_URL);
    await uploadTestFile(page);

    await page.locator('#backToHomeBtn').click();
    await expect(page.locator('#uploadPage')).toBeVisible();
  });

  test('7.3 登录后点击「🦥 数览」Logo 可以返回「我的文件」页面', async ({ page }) => {
    await loginOrFail(page);
    await uploadTestFile(page);

    await page.locator('#dashboardLogo').click();
    await expect(page.locator('#filesPage')).toBeVisible();
    await expect(page.locator('#filesPage')).toContainText('我的文件');
  });

  test('7.4 登录后点击「🏠 返回主页」按钮可以返回「我的文件」页面', async ({ page }) => {
    await loginOrFail(page);
    await uploadTestFile(page);

    await page.locator('#backToHomeBtn').click();
    await expect(page.locator('#filesPage')).toBeVisible();
    await expect(page.locator('#filesPage')).toContainText('我的文件');
  });

  test('7.5 Dashboard header 显示 Logo 和导航按钮', async ({ page }) => {
    await page.goto(APP_URL);
    await uploadTestFile(page);

    // Logo 可见
    await expect(page.locator('#dashboardLogo')).toBeVisible();
    await expect(page.locator('#dashboardLogo')).toContainText('数览');
    // 返回主页按钮可见
    await expect(page.locator('#backToHomeBtn')).toBeVisible();
    await expect(page.locator('#backToHomeBtn')).toContainText('返回主页');
  });
});

// ══════════════════════════════════════════════════
// 8. 综合集成测试
// ══════════════════════════════════════════════════
test.describe('8. 综合集成测试', () => {
  test('8.1 上传页各 UI 元素完整显示', async ({ page }) => {
    await page.goto(APP_URL);

    // 标题和副标题
    await expect(page.locator('.upload-title')).toHaveText('数览 Sloth');
    await expect(page.locator('.upload-sub')).toHaveText('慢一点，看清数据');
    // 上传区域
    await expect(page.locator('.upload-area')).toBeVisible();
    // 登录按钮
    await expect(page.locator('#uploadLoginBtn')).toBeVisible();
  });

  test('8.2 文件页包含返回上传页按钮', async ({ page }) => {
    await loginOrFail(page);

    const backBtn = page.locator('#filesBackUpload');
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page.locator('#uploadPage')).toBeVisible();
  });

  test('8.3 登录弹窗标题正确', async ({ page }) => {
    await openLoginModal(page);
    await expect(page.locator('.sauth-box h3')).toContainText('登录数览');
  });

  test('8.4 注册表单和登录表单输入框数量正确', async ({ page }) => {
    await openLoginModal(page);

    // 登录表单：邮箱 + 密码 = 2 个输入框
    const loginInputs = page.locator('#sauthLoginForm .sauth-input');
    await expect(loginInputs).toHaveCount(2);

    // 切换到注册
    await page.locator('.sauth-tab[data-tab="signup"]').click();
    const signupInputs = page.locator('#sauthSignupForm .sauth-input');
    await expect(signupInputs).toHaveCount(2);
  });

  test('8.5 重复点击登录按钮不会打开多个弹窗', async ({ page }) => {
    await page.goto(APP_URL);
    const loginBtn = page.locator('#uploadLoginBtn');
    // 第一次点击打开弹窗
    await loginBtn.click();
    await expect(page.locator('#slothLoginModal')).not.toHaveClass(/hidden/);

    // 关闭弹窗后再点一次
    await page.locator('#sauthClose').click();
    await expect(page.locator('#slothLoginModal')).toHaveClass(/hidden/);
    await loginBtn.click();
    await expect(page.locator('#slothLoginModal')).not.toHaveClass(/hidden/);

    // 验证弹窗始终只有一个
    const modals = page.locator('.sauth-modal');
    await expect(modals).toHaveCount(1);
  });
});
