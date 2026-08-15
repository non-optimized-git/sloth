const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..');
const FRAMES_DIR = path.join(BASE, 'temp-frames');
const VIDEO_DIR = path.join(BASE, 'temp-video');

// 新脚本的9幕
const scenes = [
  { narration: '这是数览，一款问卷数据可视化工具。上传 Excel，自动生成交互式图表。' },
  { narration: '把问卷数据拖进来，数览会自动识别单选和多选题，瞬间生成所有题目的图表。' },
  { narration: '左侧导航可以快速定位任意一道题，滚动时自动高亮当前题目。' },
  { narration: '核心功能是表头交叉分析。选一个题目的选项作为表头，图表立刻变成多列并排对比，每列显示独立的样本量。还可以创建复杂表头，跨题目合并选项。' },
  { narration: '显示设置可以切换数据格式、开启差异高亮标记最高值和最低值、调节柱体粗细。' },
  { narration: '一键复制为 Markdown 表格，直接粘贴到飞书，格式完整保留。' },
  { narration: '可以给题目分组、拖拽调整顺序。点击右上角切换夜览模式，护眼又好看。' },
  { narration: '所有配置可以导出为 JSON 文件，下次打开直接导入，所有设置瞬间恢复。' },
  { narration: '数览，慢一点，看清数据。' }
];

function getDuration(mp3Path) {
  const result = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${mp3Path}"`).toString().trim();
  return parseFloat(result);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  // 清理临时目录
  if (fs.existsSync(FRAMES_DIR)) fs.rmSync(FRAMES_DIR, { recursive: true });
  if (fs.existsSync(VIDEO_DIR)) fs.rmSync(VIDEO_DIR, { recursive: true });
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  fs.mkdirSync(VIDEO_DIR, { recursive: true });

  // 生成语音
  console.log('🎤 生成语音...');
  const durations = [];
  for (let i = 0; i < scenes.length; i++) {
    const mp3 = path.join(FRAMES_DIR, `n${i}.mp3`);
    execSync(`python3 -m edge_tts --text "${scenes[i].narration}" --voice zh-CN-XiaoxiaoNeural --write-media "${mp3}"`);
    durations.push(getDuration(mp3));
    console.log(`  ${i + 1}. ${scenes[i].narration.substring(0, 30)}... (${durations[i].toFixed(1)}s)`);
  }

  // 拼接音频
  console.log('\n🔊 拼接音频...');
  let concat = '';
  for (let i = 0; i < scenes.length; i++) concat += `file '${path.join(FRAMES_DIR, `n${i}.mp3`)}'\n`;
  fs.writeFileSync(path.join(FRAMES_DIR, 'list.txt'), concat);
  execSync(`ffmpeg -y -f concat -safe 0 -i "${path.join(FRAMES_DIR, 'list.txt')}" -c:a aac "${path.join(FRAMES_DIR, 'audio.m4a')}" 2>/dev/null`);

  // 启动浏览器
  console.log('\n🎬 启动录制...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } }
  });
  const page = await context.newPage();

  // 加载页面
  await page.goto('http://localhost:8765/index.html', { timeout: 60000, waitUntil: 'domcontentloaded' });
  await sleep(2000);

  // === 第 1 幕：开场 ===
  console.log(`  🎬 1. 开场 (${durations[0].toFixed(1)}s)`);
  await sleep(durations[0] * 1000);

  // === 第 2 幕：上传 ===
  console.log(`  🎬 2. 上传 (${durations[1].toFixed(1)}s)`);
  await page.click('#uploadArea');
  await sleep(500);
  const fileInput = await page.$('#fileInput');
  await fileInput.setInputFiles(path.join(BASE, 'scripts', 'test-data.xlsx'));
  await page.waitForFunction(() => document.getElementById('dashboard').style.display !== 'none', { timeout: 15000 });
  await sleep(Math.max(0, durations[1] * 1000 - 1200));

  // === 第 3 幕：导航 ===
  console.log(`  🎬 3. 导航 (${durations[2].toFixed(1)}s)`);
  const items3 = await page.$$('.nav-item');
  if (items3.length > 1) await items3[1].click();
  await sleep(1500);
  if (items3.length > 2) await items3[2].click();
  await sleep(Math.max(0, durations[2] * 1000 - 2500));

  // === 第 4 幕：表头交叉分析 ===
  console.log(`  🎬 4. 表头交叉分析 (${durations[3].toFixed(1)}s)`);
  await page.click('#addHeaderBtn');
  await sleep(800);
  await page.selectOption('#simpleQDropdown', { index: 1 });
  await sleep(600);
  await page.evaluate(() => {
    const opts = document.querySelectorAll('.picker-opt');
    if (opts.length > 0) opts[0].click();
  });
  await sleep(800);
  await page.evaluate(() => {
    const opts = document.querySelectorAll('.picker-opt');
    if (opts.length > 1) opts[1].click();
  });
  await sleep(800);
  await page.click('#pickerConfirm');
  await sleep(Math.max(0, durations[3] * 1000 - 4000));

  // === 第 5 幕：显示设置 ===
  console.log(`  🎬 5. 显示设置 (${durations[4].toFixed(1)}s)`);
  await page.click('#modeOptions .seg:nth-child(2)');
  await sleep(1200);
  await page.click('#modeOptions .seg:nth-child(3)');
  await sleep(1200);
  await page.click('#diffToggle');
  await sleep(Math.max(0, durations[4] * 1000 - 3000));

  // === 第 6 幕：复制 ===
  console.log(`  🎬 6. 复制 (${durations[5].toFixed(1)}s)`);
  await page.evaluate(() => {
    const chart = document.querySelector('.q-section');
    if (chart) chart.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await sleep(500);
  const copyBtn = await page.$('.copy-btn');
  if (copyBtn) await copyBtn.click();
  await sleep(Math.max(0, durations[5] * 1000 - 1000));

  // === 第 7 幕：分组与夜览 ===
  console.log(`  🎬 7. 分组与夜览 (${durations[6].toFixed(1)}s)`);
  await page.click('#addGroupBtn');
  await sleep(1500);
  try {
    const groupName = await page.$('.group-name');
    if (groupName) {
      await groupName.dblclick();
      await sleep(500);
      await page.fill('.group-name-input', '用户画像');
      await page.press('.group-name-input', 'Enter');
    }
  } catch (e) {}
  await sleep(1000);
  await page.click('#themeToggle');
  await sleep(Math.max(0, durations[6] * 1000 - 3500));

  // === 第 8 幕：配置导出 ===
  console.log(`  🎬 8. 配置导出 (${durations[7].toFixed(1)}s)`);
  await page.click('#themeToggle');
  await sleep(800);
  await page.click('#exportBtn');
  await sleep(Math.max(0, durations[7] * 1000 - 1200));

  // === 第 9 幕：结尾 ===
  console.log(`  🎬 9. 结尾 (${durations[8].toFixed(1)}s)`);
  // 注入 Logo 页面
  await page.evaluate(() => {
    document.body.innerHTML = `
      <div style="position:fixed;inset:0;background:linear-gradient(135deg,#f7f3ee 0%,#e8ddd0 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999">
        <div style="font-size:120px;margin-bottom:24px">🦥</div>
        <div style="font-size:48px;font-weight:700;color:#5c4a3a;margin-bottom:12px">数览 Sloth</div>
        <div style="font-size:20px;color:#5a7a4a;font-weight:500">慢一点，看清数据</div>
      </div>
    `;
  });
  await sleep(durations[8] * 1000);

  // 停止录制
  console.log('\n📼 停止录制...');
  const videoPath = await page.video().path();
  await page.close();
  await context.close();
  await browser.close();

  // 合成
  console.log('🎬 合成视频...');
  execSync(`ffmpeg -y -i "${videoPath}" -c:v libx264 -pix_fmt yuv420p "${path.join(VIDEO_DIR, 'video.mp4')}" 2>/dev/null`);
  const out = path.join(BASE, '数览Sloth-产品演示.mp4');
  execSync(`ffmpeg -y -i "${path.join(VIDEO_DIR, 'video.mp4')}" -i "${path.join(FRAMES_DIR, 'audio.m4a')}" -c:v copy -c:a aac -shortest "${out}" 2>/dev/null`);

  const totalDur = durations.reduce((a, b) => a + b, 0);
  console.log(`\n✅ 完成！`);
  console.log(`📁 ${out}`);
  console.log(`⏱  ${Math.floor(totalDur / 60)}:${String(Math.floor(totalDur % 60)).padStart(2, '0')}`);

  // 清理临时目录
  fs.rmSync(FRAMES_DIR, { recursive: true });
  fs.rmSync(VIDEO_DIR, { recursive: true });
  console.log('🧹 临时文件已清理');
}

main().catch(e => { console.error(e); process.exit(1); });
