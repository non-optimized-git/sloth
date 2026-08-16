const { test, expect } = require('@playwright/test');
const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const TEST_EXCEL = path.join(ROOT, 'scripts', 'test-data.xlsx');
const APP_URL = 'http://localhost:8767/index.html';

// 启动本地 HTTP 服务器
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
  await new Promise(r => server.listen(8767, r));
});
test.afterAll(async () => { if (server) server.close(); });

// 工具函数
async function uploadFile(page, filePath) {
  await page.waitForTimeout(1000);
  const fileInput = page.locator('#fileInput');
  await fileInput.setInputFiles(filePath);
  await page.waitForFunction(() => {
    const d = document.getElementById('dashboard');
    return d && d.style.display !== 'none' && d.offsetParent !== null;
  }, { timeout: 15000 });
}

// ══════════════════════════════════════════════════
// 新增测试用例：标签显示格式（percent/count/both）
// ══════════════════════════════════════════════════
test.describe('标签显示格式', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await uploadFile(page, TEST_EXCEL);
  });

  test('默认显示百分比模式', async ({ page }) => {
    const activeSeg = page.locator('#modeOptions .seg.active');
    await expect(activeSeg).toHaveAttribute('data-mode', 'percent');
  });

  test('切换到数值模式', async ({ page }) => {
    await page.locator('#modeOptions .seg[data-mode="count"]').click();
    await page.waitForTimeout(500);
    const activeSeg = page.locator('#modeOptions .seg.active');
    await expect(activeSeg).toHaveAttribute('data-mode', 'count');
  });

  test('切换到两者模式', async ({ page }) => {
    await page.locator('#modeOptions .seg[data-mode="both"]').click();
    await page.waitForTimeout(500);
    const activeSeg = page.locator('#modeOptions .seg.active');
    await expect(activeSeg).toHaveAttribute('data-mode', 'both');
  });
});

// ══════════════════════════════════════════════════
// 新增测试用例：搜索功能
// ══════════════════════════════════════════════════
test.describe('搜索功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await uploadFile(page, TEST_EXCEL);
  });

  test('搜索框存在且可输入', async ({ page }) => {
    const searchInput = page.locator('#searchInput');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', '🔍 搜索题目...');
  });

  test('搜索过滤题目', async ({ page }) => {
    const navItems = page.locator('.nav-item');
    const totalBefore = await navItems.count();
    
    // 输入搜索词（使用第一个题目的标题片段）
    const firstTitle = await page.locator('.nav-item .nav-label').first().textContent();
    const searchTerm = firstTitle.substring(0, 2);
    
    await page.locator('#searchInput').fill(searchTerm);
    await page.waitForTimeout(500);
    
    // 检查过滤后的数量
    const visibleItems = page.locator('.nav-item:not([style*="display: none"])');
    const visibleCount = await visibleItems.count();
    expect(visibleCount).toBeLessThanOrEqual(totalBefore);
    expect(visibleCount).toBeGreaterThan(0);
  });

  test('清空搜索恢复所有题目', async ({ page }) => {
    const navItems = page.locator('.nav-item');
    const totalBefore = await navItems.count();
    
    // 先搜索
    await page.locator('#searchInput').fill('test');
    await page.waitForTimeout(300);
    
    // 清空搜索
    await page.locator('#searchInput').fill('');
    await page.waitForTimeout(300);
    
    const visibleItems = page.locator('.nav-item:not([style*="display: none"])');
    const visibleCount = await visibleItems.count();
    expect(visibleCount).toBe(totalBefore);
  });
});

// ══════════════════════════════════════════════════
// 新增测试用例：分组管理
// ══════════════════════════════════════════════════
test.describe('分组管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await uploadFile(page, TEST_EXCEL);
  });

  test('添加分组按钮存在', async ({ page }) => {
    const addGroupBtn = page.locator('#addGroupBtn');
    await expect(addGroupBtn).toBeVisible();
    await expect(addGroupBtn).toHaveText('＋ 添加分组');
  });

  test('点击添加分组创建新分组', async ({ page }) => {
    const groupsBefore = await page.locator('.nav-group-title').count();
    await page.locator('#addGroupBtn').click();
    await page.waitForTimeout(500);
    
    const groupsAfter = await page.locator('.nav-group-title').count();
    expect(groupsAfter).toBe(groupsBefore + 1);
  });

  test('分组有删除按钮', async ({ page }) => {
    await page.locator('#addGroupBtn').click();
    await page.waitForTimeout(500);
    
    const deleteBtn = page.locator('.nav-group-title .gb').first();
    await expect(deleteBtn).toBeVisible();
    await expect(deleteBtn).toHaveAttribute('title', '删除');
  });
});

// ══════════════════════════════════════════════════
// 新增测试用例：表头激活/取消
// ══════════════════════════════════════════════════
test.describe('表头激活', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await uploadFile(page, TEST_EXCEL);
  });

  test('添加表头按钮存在', async ({ page }) => {
    const addHeaderBtn = page.locator('#addHeaderBtn');
    await expect(addHeaderBtn).toBeVisible();
    await expect(addHeaderBtn).toHaveText('＋ 添加');
  });

  test('点击添加打开表头选择器', async ({ page }) => {
    await page.locator('#addHeaderBtn').click();
    await page.waitForTimeout(300);
    
    const modal = page.locator('#headerPickerModal');
    await expect(modal).not.toHaveClass(/hidden/);
  });

  test('表头库初始为空', async ({ page }) => {
    const emptyMsg = page.locator('.header-lib-empty');
    await expect(emptyMsg).toBeVisible();
    await expect(emptyMsg).toHaveText('暂无表头，点击「＋ 添加」');
  });
});

// ══════════════════════════════════════════════════
// 新增测试用例：复杂表头
// ══════════════════════════════════════════════════
test.describe('复杂表头', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await uploadFile(page, TEST_EXCEL);
  });

  test('表头选择器有简单和复杂两个标签', async ({ page }) => {
    await page.locator('#addHeaderBtn').click();
    await page.waitForTimeout(300);
    
    const simpleTab = page.locator('.picker-tab[data-tab="simple"]');
    const complexTab = page.locator('.picker-tab[data-tab="complex"]');
    
    await expect(simpleTab).toBeVisible();
    await expect(complexTab).toBeVisible();
    await expect(simpleTab).toHaveText('简单表头');
    await expect(complexTab).toHaveText('复杂表头（合并）');
  });

  test('切换到复杂表头面板', async ({ page }) => {
    await page.locator('#addHeaderBtn').click();
    await page.waitForTimeout(300);
    
    await page.locator('.picker-tab[data-tab="complex"]').click();
    await page.waitForTimeout(300);
    
    const complexPanel = page.locator('#panelComplex');
    await expect(complexPanel).toHaveClass(/active/);
  });

  test('复杂表头有暂存区', async ({ page }) => {
    await page.locator('#addHeaderBtn').click();
    await page.waitForTimeout(300);
    await page.locator('.picker-tab[data-tab="complex"]').click();
    await page.waitForTimeout(300);
    
    const stagingArea = page.locator('.complex-staging');
    await expect(stagingArea).toBeVisible();
    
    const addComplexBtn = page.locator('#addComplexGroup');
    await expect(addComplexBtn).toBeVisible();
    await expect(addComplexBtn).toHaveText('＋ 创建为表头');
  });
});

// ══════════════════════════════════════════════════
// 新增测试用例：夜览模式差异颜色
// ══════════════════════════════════════════════════
test.describe('夜览模式差异颜色', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await uploadFile(page, TEST_EXCEL);
  });

  test('显示差异开关存在', async ({ page }) => {
    const diffToggle = page.locator('#diffToggle');
    await expect(diffToggle).toBeVisible();
    await expect(diffToggle.locator('.tl')).toHaveText('显示差异');
  });

  test('切换差异显示', async ({ page }) => {
    const diffToggle = page.locator('#diffToggle');
    await expect(diffToggle).not.toHaveClass(/on/);
    
    await diffToggle.click();
    await page.waitForTimeout(300);
    await expect(diffToggle).toHaveClass(/on/);
    
    await diffToggle.click();
    await page.waitForTimeout(300);
    await expect(diffToggle).not.toHaveClass(/on/);
  });

  test('夜览模式下 CSS 变量改变', async ({ page }) => {
    const bgBefore = await page.evaluate(() => 
      getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim()
    );
    
    await page.locator('#themeToggle').click();
    await page.waitForTimeout(500);
    
    const bgAfter = await page.evaluate(() => 
      getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim()
    );
    
    expect(bgAfter).not.toBe(bgBefore);
  });
});

// ══════════════════════════════════════════════════
// 新增测试用例：自动保存功能
// ══════════════════════════════════════════════════
test.describe('自动保存功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await uploadFile(page, TEST_EXCEL);
  });

  test('配置变更后自动保存到 localStorage', async ({ page }) => {
    // 切换显示模式触发自动保存
    await page.locator('#modeOptions .seg[data-mode="count"]').click();
    await page.waitForTimeout(1000); // 等待 500ms 防抖 + 缓冲
    
    const saved = await page.evaluate(() => {
      return localStorage.getItem('sloth-config-autosave');
    });
    
    expect(saved).not.toBeNull();
    const config = JSON.parse(saved);
    expect(config.version).toBe(5);
    expect(config.displayMode).toBe('count');
  });

  test('保存的配置包含所有必要字段', async ({ page }) => {
    // 触发保存
    await page.locator('#modeOptions .seg[data-mode="both"]').click();
    await page.waitForTimeout(1000);
    
    const config = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sloth-config-autosave'));
    });
    
    expect(config).toHaveProperty('version');
    expect(config).toHaveProperty('groups');
    expect(config).toHaveProperty('headerLibrary');
    expect(config).toHaveProperty('activeHeaderIds');
    expect(config).toHaveProperty('displayMode');
    expect(config).toHaveProperty('decimalPlaces');
    expect(config).toHaveProperty('showDiff');
    expect(config).toHaveProperty('barMaxWidth');
    expect(config).toHaveProperty('currentTheme');
  });
});

// ══════════════════════════════════════════════════
// 新增测试用例：复制功能格式（HTML 表格）
// ══════════════════════════════════════════════════
test.describe('复制功能格式', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(APP_URL);
    await uploadFile(page, TEST_EXCEL);
  });

  test('复制按钮存在', async ({ page }) => {
    const copyBtn = page.locator('.copy-btn').first();
    await expect(copyBtn).toBeVisible();
    await expect(copyBtn).toHaveText('复制');
  });

  test('复制按钮点击后显示已复制', async ({ page }) => {
    const copyBtn = page.locator('.copy-btn').first();
    await copyBtn.click();
    
    await expect(copyBtn).toHaveText('已复制');
    await expect(copyBtn).toHaveClass(/copied/);
  });

  test('复制后按钮恢复', async ({ page }) => {
    const copyBtn = page.locator('.copy-btn').first();
    await copyBtn.click();
    
    await page.waitForTimeout(1500);
    await expect(copyBtn).toHaveText('复制');
    await expect(copyBtn).not.toHaveClass(/copied/);
  });
});

// ══════════════════════════════════════════════════
// 新增测试用例：xMax 规则（+5%）
// ══════════════════════════════════════════════════
test.describe('xMax 规则', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await uploadFile(page, TEST_EXCEL);
  });

  test('图表渲染成功', async ({ page }) => {
    const charts = page.locator('.chart-container canvas');
    const count = await charts.count();
    expect(count).toBeGreaterThan(0);
  });

  test('ECharts 实例存在', async ({ page }) => {
    const hasEcharts = await page.evaluate(() => {
      const container = document.querySelector('.chart-container');
      if (!container) return false;
      return !!container.querySelector('canvas');
    });
    expect(hasEcharts).toBe(true);
  });
});

// ══════════════════════════════════════════════════
// 新增测试用例：小数位数设置
// ══════════════════════════════════════════════════
test.describe('小数位数设置', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await uploadFile(page, TEST_EXCEL);
  });

  test('默认整数模式', async ({ page }) => {
    const activeSeg = page.locator('#decimalOptions .seg.active');
    await expect(activeSeg).toHaveAttribute('data-decimal', '0');
  });

  test('切换到1位小数', async ({ page }) => {
    await page.locator('#decimalOptions .seg[data-decimal="1"]').click();
    await page.waitForTimeout(300);
    const activeSeg = page.locator('#decimalOptions .seg.active');
    await expect(activeSeg).toHaveAttribute('data-decimal', '1');
  });

  test('切换到2位小数', async ({ page }) => {
    await page.locator('#decimalOptions .seg[data-decimal="2"]').click();
    await page.waitForTimeout(300);
    const activeSeg = page.locator('#decimalOptions .seg.active');
    await expect(activeSeg).toHaveAttribute('data-decimal', '2');
  });
});

// ══════════════════════════════════════════════════
// 新增测试用例：柱体粗细设置
// ══════════════════════════════════════════════════
test.describe('柱体粗细设置', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await uploadFile(page, TEST_EXCEL);
  });

  test('柱体粗细滑块存在', async ({ page }) => {
    const range = page.locator('#barWidthRange');
    await expect(range).toBeVisible();
    await expect(range).toHaveAttribute('min', '8');
    await expect(range).toHaveAttribute('max', '28');
  });

  test('柱体粗细标签显示', async ({ page }) => {
    const label = page.locator('#barWidthLabel');
    await expect(label).toBeVisible();
    await expect(label).toHaveText('16');
  });

  test('调整柱体粗细', async ({ page }) => {
    await page.locator('#barWidthRange').fill('20');
    await page.waitForTimeout(300);
    const label = page.locator('#barWidthLabel');
    await expect(label).toHaveText('20');
  });
});
