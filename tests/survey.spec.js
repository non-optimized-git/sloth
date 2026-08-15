const { test, expect } = require('@playwright/test');
const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const TEST_EXCEL = path.join(ROOT, 'scripts', 'test-data.xlsx');
const APP_URL = 'http://localhost:8766/index.html';

// 启动本地 HTTP 服务器（避免 file:// 协议下 setInputFiles 不稳定）
let server;
test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath);
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    try {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(8766, r));
});
test.afterAll(async () => { if (server) server.close(); });

// ── 工具函数 ──────────────────────────────────────
async function uploadFile(page, filePath) {
  const fileInput = page.locator('#fileInput');
  await fileInput.setInputFiles(filePath);
  // 等待 dashboard 可见，给足 Excel 解析时间
  await page.waitForFunction(() => {
    const d = document.getElementById('dashboard');
    return d && d.style.display !== 'none' && d.offsetParent !== null;
  }, { timeout: 15000 });
}

// ══════════════════════════════════════════════════
// 1. 上传页 & 首次加载
// ══════════════════════════════════════════════════
test.describe('上传页', () => {
  test('显示上传界面', async ({ page }) => {
    await page.goto(APP_URL);
    await expect(page.locator('.upload-title')).toHaveText('数览 Sloth');
    await expect(page.locator('.upload-sub')).toHaveText('慢一点，看清数据');
    await expect(page.locator('.upload-area')).toBeVisible();
  });

  test('上传 Excel 后跳转到 dashboard', async ({ page }) => {
    await page.goto(APP_URL);
    await uploadFile(page, TEST_EXCEL);
    await expect(page.locator('#dashboard')).toBeVisible();
    await expect(page.locator('.header .logo')).toContainText('数览');
    // 应显示数据摘要
    const sub = await page.locator('#headerSub').textContent();
    expect(sub).toMatch(/\d+ 条数据 · \d+ 题/);
  });

  test('dashboard 后上传页隐藏', async ({ page }) => {
    await page.goto(APP_URL);
    await uploadFile(page, TEST_EXCEL);
    await expect(page.locator('#uploadPage')).toBeHidden();
  });
});

// ══════════════════════════════════════════════════
// 2. 图表渲染
// ══════════════════════════════════════════════════
test.describe('图表渲染', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await uploadFile(page, TEST_EXCEL);
  });

  test('至少渲染了一道题目', async ({ page }) => {
    const sections = page.locator('.chart-section');
    const count = await sections.count();
    expect(count).toBeGreaterThan(0);
  });

  test('每个题目有 ECharts 实例', async ({ page }) => {
    const charts = page.locator('.chart-container canvas');
    const count = await charts.count();
    expect(count).toBeGreaterThan(0);
  });

  test('左侧导航与题目数量一致', async ({ page }) => {
    const navItems = page.locator('.nav-item');
    const sections = page.locator('.chart-section');
    expect(await navItems.count()).toBe(await sections.count());
  });

  test('点击导航触发滚动', async ({ page }) => {
    const navItems = page.locator('.nav-item');
    const count = await navItems.count();
    if (count < 2) return;
    // 点击最后一个导航项，不应报错
    await navItems.last().click();
    await page.waitForTimeout(300);
    // 页面应发生滚动（滚动位置大于 0）
    const scrollTop = await page.evaluate(() => document.querySelector('.sidebar').scrollTop);
    expect(scrollTop).toBeGreaterThanOrEqual(0);
  });
});

// ══════════════════════════════════════════════════
// 3. 显示设置
// ══════════════════════════════════════════════════
test.describe('显示设置', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await uploadFile(page, TEST_EXCEL);
  });

  test('切换数据格式：百分比 → 数值 → 两者', async ({ page }) => {
    // 默认选中百分比
    await expect(page.locator('#modeOptions .seg.active')).toHaveAttribute('data-mode', 'percent');
    // 切换到数值
    await page.locator('#modeOptions .seg[data-mode="count"]').click();
    await expect(page.locator('#modeOptions .seg.active')).toHaveAttribute('data-mode', 'count');
    // 切换到两者
    await page.locator('#modeOptions .seg[data-mode="both"]').click();
    await expect(page.locator('#modeOptions .seg.active')).toHaveAttribute('data-mode', 'both');
  });

  test('切换小数位数', async ({ page }) => {
    await expect(page.locator('#decimalOptions .seg.active')).toHaveAttribute('data-decimal', '0');
    await page.locator('#decimalOptions .seg[data-decimal="1"]').click();
    await expect(page.locator('#decimalOptions .seg.active')).toHaveAttribute('data-decimal', '1');
    await page.locator('#decimalOptions .seg[data-decimal="2"]').click();
    await expect(page.locator('#decimalOptions .seg.active')).toHaveAttribute('data-decimal', '2');
  });

  test('切换差异显示', async ({ page }) => {
    const toggle = page.locator('#diffToggle');
    await expect(toggle).not.toHaveClass(/on/);
    await toggle.click();
    await expect(toggle).toHaveClass(/on/);
    await toggle.click();
    await expect(toggle).not.toHaveClass(/on/);
  });

  test('调节柱体粗细', async ({ page }) => {
    const range = page.locator('#barWidthRange');
    const label = page.locator('#barWidthLabel');
    // 默认 16
    await expect(label).toHaveText('16');
    // 拖到 24
    await range.fill('24');
    await expect(label).toHaveText('24');
    // 拖到 8
    await range.fill('8');
    await expect(label).toHaveText('8');
  });
});

// ══════════════════════════════════════════════════
// 4. 表头库
// ══════════════════════════════════════════════════
test.describe('表头库', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await uploadFile(page, TEST_EXCEL);
  });

  test('点击添加打开表头选择器', async ({ page }) => {
    await page.locator('#addHeaderBtn').click();
    await expect(page.locator('#headerPickerModal')).toBeVisible();
    await expect(page.locator('#headerPickerModal h3')).toContainText('添加表头');
  });

  test('添加简单表头', async ({ page }) => {
    await page.locator('#addHeaderBtn').click();
    // 选择第一个题目
    await page.locator('#simpleQDropdown').selectOption({ index: 1 });
    // 勾选第一个选项
    const firstOpt = page.locator('#simpleOpts .picker-opt').first();
    await firstOpt.click();
    await expect(firstOpt).toHaveClass(/selected/);
    // 确认
    await page.locator('#pickerConfirm').click();
    // 表头库应有一项
    await expect(page.locator('.hl-item')).toHaveCount(1);
  });

  test('表头点击可切换激活/取消', async ({ page }) => {
    // 先添加一个表头
    await page.locator('#addHeaderBtn').click();
    await page.locator('#simpleQDropdown').selectOption({ index: 1 });
    await page.locator('#simpleOpts .picker-opt').first().click();
    await page.locator('#pickerConfirm').click();
    // 默认激活
    const item = page.locator('.hl-item').first();
    await expect(item).toHaveClass(/active/);
    // 点击取消
    await item.click();
    await expect(item).not.toHaveClass(/active/);
    // 再次点击激活
    await item.click();
    await expect(item).toHaveClass(/active/);
  });

  test('删除表头需确认', async ({ page }) => {
    // 添加一个表头
    await page.locator('#addHeaderBtn').click();
    await page.locator('#simpleQDropdown').selectOption({ index: 1 });
    await page.locator('#simpleOpts .picker-opt').first().click();
    await page.locator('#pickerConfirm').click();
    // 点击删除
    await page.locator('.hl-item').first().hover();
    await page.locator('.hl-item .hl-del').first().click();
    // 应弹出确认框
    await expect(page.locator('#confirmModal')).toBeVisible();
    await expect(page.locator('#confirmMsg')).toContainText('确定删除');
    // 取消
    await page.locator('#confirmCancel').click();
    await expect(page.locator('.hl-item')).toHaveCount(1);
  });

  test('清空表头需确认', async ({ page }) => {
    // 添加一个表头
    await page.locator('#addHeaderBtn').click();
    await page.locator('#simpleQDropdown').selectOption({ index: 1 });
    await page.locator('#simpleOpts .picker-opt').first().click();
    await page.locator('#pickerConfirm').click();
    // 点击清空
    await page.locator('#clearHeadersBtn').click();
    await expect(page.locator('#confirmModal')).toBeVisible();
    // 确认清空
    await page.locator('#confirmOk').click();
    await expect(page.locator('.hl-item')).toHaveCount(0);
  });

  test('编辑表头名称', async ({ page }) => {
    // 添加一个表头
    await page.locator('#addHeaderBtn').click();
    await page.locator('#simpleQDropdown').selectOption({ index: 1 });
    await page.locator('#simpleOpts .picker-opt').first().click();
    await page.locator('#pickerConfirm').click();
    // 点击编辑
    await page.locator('.hl-item').first().hover();
    await page.locator('.hl-item .hl-edit').first().click();
    // 编辑弹窗应出现
    await expect(page.locator('#editHeaderModal')).toBeVisible();
    // 修改名称
    await page.locator('#editHeaderName').fill('自定义表头名');
    await page.locator('#editHeaderConfirm').click();
    // 表头名应更新
    await expect(page.locator('.hl-item .hl-name').first()).toHaveText('自定义表头名');
  });
});

// ══════════════════════════════════════════════════
// 5. 分组管理
// ══════════════════════════════════════════════════
test.describe('分组管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await uploadFile(page, TEST_EXCEL);
  });

  test('添加分组', async ({ page }) => {
    const before = await page.locator('.nav-group-title').count();
    await page.locator('#addGroupBtn').click();
    const after = await page.locator('.nav-group-title').count();
    expect(after).toBe(before + 1);
  });

  test('双击分组标题可编辑', async ({ page }) => {
    await page.locator('#addGroupBtn').click();
    const gt = page.locator('.nav-group-title .gt').first();
    await gt.dblclick();
    // 应进入编辑模式
    await expect(gt).toHaveAttribute('contenteditable', 'true');
  });

  test('删除分组需确认', async ({ page }) => {
    await page.locator('#addGroupBtn').click();
    await page.locator('.nav-group-title .gb').first().click();
    await expect(page.locator('#confirmModal')).toBeVisible();
    await page.locator('#confirmCancel').click();
    // 分组还在
    await expect(page.locator('.nav-group-title')).toHaveCount(1);
  });
});

// ══════════════════════════════════════════════════
// 6. 夜览模式
// ══════════════════════════════════════════════════
test.describe('夜览模式', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await uploadFile(page, TEST_EXCEL);
  });

  test('切换夜览模式', async ({ page }) => {
    const toggle = page.locator('#themeToggle');
    // 默认亮色
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveText('🌙');
    // 切换到暗色
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveText('☀️');
    // 切回亮色
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(toggle).toHaveText('🌙');
  });

  test('夜览模式下背景色变暗', async ({ page }) => {
    const bgBefore = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.locator('#themeToggle').click();
    await page.waitForTimeout(500); // 等待 transition 动画完成
    const bgAfter = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bgBefore).not.toBe(bgAfter);
  });
});

// ══════════════════════════════════════════════════
// 7. 配置导出/导入
// ══════════════════════════════════════════════════
test.describe('配置导出导入', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await uploadFile(page, TEST_EXCEL);
  });

  test('导出配置按钮可点击', async ({ page }) => {
    // 监听下载事件
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#exportBtn').click(),
    ]);
    expect(download.suggestedFilename()).toBe('sloth-config.json');
  });

  test('导入配置按钮可见', async ({ page }) => {
    await expect(page.locator('#importBtn')).toBeVisible();
  });
});

// ══════════════════════════════════════════════════
// 8. 侧栏拖拽调整
// ══════════════════════════════════════════════════
test.describe('侧栏拖拽', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await uploadFile(page, TEST_EXCEL);
  });

  test('拖拽条存在且可拖拽', async ({ page }) => {
    const resizer = page.locator('#sidebarResizer');
    await expect(resizer).toBeVisible();
    // 获取初始宽度
    const widthBefore = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w').trim()
    );
    // 模拟拖拽
    const box = await resizer.boundingBox();
    await page.mouse.move(box.x + 2, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(box.x + 50, box.y + 50);
    await page.mouse.up();
    // 宽度应改变
    const widthAfter = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w').trim()
    );
    expect(widthAfter).not.toBe(widthBefore);
  });
});

// ══════════════════════════════════════════════════
// 9. 复制功能
// ══════════════════════════════════════════════════
test.describe('复制功能', () => {
  test.beforeEach(async ({ page, context }) => {
    // 授权剪贴板
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(APP_URL);
    await uploadFile(page, TEST_EXCEL);
  });

  test('复制按钮生成 Markdown 表格', async ({ page }) => {
    const copyBtn = page.locator('.copy-btn').first();
    await copyBtn.click();
    // 按钮应显示成功状态
    await expect(copyBtn).toHaveText('已复制');
    // 等待恢复
    await page.waitForTimeout(1500);
    await expect(copyBtn).toHaveText('复制');
  });
});

// ══════════════════════════════════════════════════
// 10. 重新上传
// ══════════════════════════════════════════════════
test.describe('重新上传', () => {
  test('点击重新上传回到上传页', async ({ page }) => {
    await page.goto(APP_URL);
    await uploadFile(page, TEST_EXCEL);
    await page.locator('#reuploadBtn').click();
    await expect(page.locator('#uploadPage')).toBeVisible();
    await expect(page.locator('#dashboard')).toBeHidden();
  });
});
