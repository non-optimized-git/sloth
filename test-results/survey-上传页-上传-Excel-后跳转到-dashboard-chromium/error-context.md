# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: survey.spec.js >> 上传页 >> 上传 Excel 后跳转到 dashboard
- Location: tests/survey.spec.js:29:3

# Error details

```
TimeoutError: page.waitForFunction: Timeout 5000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]: 🦥
  - generic [ref=e5]: 数览 Sloth
  - generic [ref=e6]: 慢一点，看清数据
  - generic [ref=e7]: 上传 Excel 问卷数据，自动生成交互式图表第一行为题目，下方为数据行
  - generic [ref=e8] [cursor=pointer]:
    - paragraph [ref=e9]: 📄 点击选择或拖拽 Excel 文件
    - paragraph [ref=e10]: 支持 .xlsx / .xls
  - generic [ref=e11]:
    - generic [ref=e12]: 🐾
    - text: 数览 v5.0 · 慢工出细活
    - generic [ref=e13]: 🐾
```

# Test source

```ts
  1   | const { test, expect } = require('@playwright/test');
  2   | const path = require('path');
  3   | 
  4   | const APP_URL = 'file://' + path.resolve(__dirname, '../index.html');
  5   | const TEST_EXCEL = '/Users/mac/Downloads/test_fruit.xlsx';
  6   | 
  7   | // ── 工具函数 ──────────────────────────────────────
  8   | async function uploadFile(page, filePath) {
  9   |   const fileInput = page.locator('#fileInput');
  10  |   await fileInput.setInputFiles(filePath);
  11  |   // 等待 dashboard 可见，给足 Excel 解析时间
> 12  |   await page.waitForFunction(() => {
      |              ^ TimeoutError: page.waitForFunction: Timeout 5000ms exceeded.
  13  |     const d = document.getElementById('dashboard');
  14  |     return d && d.style.display !== 'none' && d.offsetParent !== null;
  15  |   }, { timeout: 15000 });
  16  | }
  17  | 
  18  | // ══════════════════════════════════════════════════
  19  | // 1. 上传页 & 首次加载
  20  | // ══════════════════════════════════════════════════
  21  | test.describe('上传页', () => {
  22  |   test('显示上传界面', async ({ page }) => {
  23  |     await page.goto(APP_URL);
  24  |     await expect(page.locator('.upload-title')).toHaveText('数览 Sloth');
  25  |     await expect(page.locator('.upload-sub')).toHaveText('慢一点，看清数据');
  26  |     await expect(page.locator('.upload-area')).toBeVisible();
  27  |   });
  28  | 
  29  |   test('上传 Excel 后跳转到 dashboard', async ({ page }) => {
  30  |     await page.goto(APP_URL);
  31  |     await uploadFile(page, TEST_EXCEL);
  32  |     await expect(page.locator('#dashboard')).toBeVisible();
  33  |     await expect(page.locator('.header .logo')).toContainText('数览');
  34  |     // 应显示数据摘要
  35  |     const sub = await page.locator('#headerSub').textContent();
  36  |     expect(sub).toMatch(/\d+ 条数据 · \d+ 题/);
  37  |   });
  38  | 
  39  |   test('dashboard 后上传页隐藏', async ({ page }) => {
  40  |     await page.goto(APP_URL);
  41  |     await uploadFile(page, TEST_EXCEL);
  42  |     await expect(page.locator('#uploadPage')).toBeHidden();
  43  |   });
  44  | });
  45  | 
  46  | // ══════════════════════════════════════════════════
  47  | // 2. 图表渲染
  48  | // ══════════════════════════════════════════════════
  49  | test.describe('图表渲染', () => {
  50  |   test.beforeEach(async ({ page }) => {
  51  |     await page.goto(APP_URL);
  52  |     await uploadFile(page, TEST_EXCEL);
  53  |   });
  54  | 
  55  |   test('至少渲染了一道题目', async ({ page }) => {
  56  |     const sections = page.locator('.chart-section');
  57  |     const count = await sections.count();
  58  |     expect(count).toBeGreaterThan(0);
  59  |   });
  60  | 
  61  |   test('每个题目有 ECharts 实例', async ({ page }) => {
  62  |     const charts = page.locator('.chart-container canvas');
  63  |     const count = await charts.count();
  64  |     expect(count).toBeGreaterThan(0);
  65  |   });
  66  | 
  67  |   test('左侧导航与题目数量一致', async ({ page }) => {
  68  |     const navItems = page.locator('.nav-item');
  69  |     const sections = page.locator('.chart-section');
  70  |     expect(await navItems.count()).toBe(await sections.count());
  71  |   });
  72  | 
  73  |   test('点击导航触发滚动', async ({ page }) => {
  74  |     const navItems = page.locator('.nav-item');
  75  |     const count = await navItems.count();
  76  |     if (count < 2) return;
  77  |     // 点击最后一个导航项，不应报错
  78  |     await navItems.last().click();
  79  |     await page.waitForTimeout(300);
  80  |     // 页面应发生滚动（滚动位置大于 0）
  81  |     const scrollTop = await page.evaluate(() => document.querySelector('.sidebar').scrollTop);
  82  |     expect(scrollTop).toBeGreaterThanOrEqual(0);
  83  |   });
  84  | });
  85  | 
  86  | // ══════════════════════════════════════════════════
  87  | // 3. 显示设置
  88  | // ══════════════════════════════════════════════════
  89  | test.describe('显示设置', () => {
  90  |   test.beforeEach(async ({ page }) => {
  91  |     await page.goto(APP_URL);
  92  |     await uploadFile(page, TEST_EXCEL);
  93  |   });
  94  | 
  95  |   test('切换数据格式：百分比 → 数值 → 两者', async ({ page }) => {
  96  |     // 默认选中百分比
  97  |     await expect(page.locator('#modeOptions .seg.active')).toHaveAttribute('data-mode', 'percent');
  98  |     // 切换到数值
  99  |     await page.locator('#modeOptions .seg[data-mode="count"]').click();
  100 |     await expect(page.locator('#modeOptions .seg.active')).toHaveAttribute('data-mode', 'count');
  101 |     // 切换到两者
  102 |     await page.locator('#modeOptions .seg[data-mode="both"]').click();
  103 |     await expect(page.locator('#modeOptions .seg.active')).toHaveAttribute('data-mode', 'both');
  104 |   });
  105 | 
  106 |   test('切换小数位数', async ({ page }) => {
  107 |     await expect(page.locator('#decimalOptions .seg.active')).toHaveAttribute('data-decimal', '0');
  108 |     await page.locator('#decimalOptions .seg[data-decimal="1"]').click();
  109 |     await expect(page.locator('#decimalOptions .seg.active')).toHaveAttribute('data-decimal', '1');
  110 |     await page.locator('#decimalOptions .seg[data-decimal="2"]').click();
  111 |     await expect(page.locator('#decimalOptions .seg.active')).toHaveAttribute('data-decimal', '2');
  112 |   });
```