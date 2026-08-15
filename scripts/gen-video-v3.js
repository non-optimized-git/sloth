const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE = path.join(__dirname, '..');
const TEMP_DIR = path.join(BASE, 'temp-video-gen');
const OUTPUT = path.join(BASE, 'docs', 'sloth-demo.mp4');
const PORT = 9876;
const INTRO_FILE = path.join(BASE, 'temp-intro.html');
const OUTRO_FILE = path.join(BASE, 'temp-outro.html');

const scenes = [
  { narration: '欢迎使用数览 Sloth，一款专为问卷数据分析设计的可视化工具。' },
  { narration: '上传 Excel 文件，自动生成所有题目的图表。左侧目录支持快速跳转，点击即可定位到任意题目。' },
  { narration: '添加表头进行交叉分析，点击即可激活，再次点击取消，操作简单直观。' },
  { narration: '还可以创建复杂表头，跨题目合并选项，自定义列名，灵活分析数据。' },
  { narration: '显示设置支持百分比、数值、或两者同时显示，开启差异高亮标记极值。' },
  { narration: '一键复制为格式化表格，直接粘贴到飞书或 Excel，保留完整格式。' },
  { narration: '支持题目分组管理，双击修改分组名称，拖拽分组调整位置。' },
  { narration: '切换夜览模式保护眼睛，所有配置自动保存，刷新不丢失。' },
  { narration: '数览 Sloth，慢一点，看清数据。' }
];

const GAP_BETWEEN_SCENES = 1.5; // 场景间隔秒数

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function elapsed(t0) { return (Date.now() - t0) / 1000; }
async function waitUntil(t0, targetSec) {
  const remain = targetSec - elapsed(t0);
  if (remain > 0) await sleep(remain * 1000);
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = req.url.split('?')[0];
        const filePath = path.join(BASE, url === '/' ? 'index.html' : url);
        const data = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        res.end(data);
      } catch (e) {
        if (!res.headersSent) { res.writeHead(404); res.end(); }
      }
    });
    server.listen(PORT, () => { console.log(`  🌐 http://localhost:${PORT}`); setTimeout(() => resolve(server), 1000); });
    server.on('error', reject);
  });
}

async function generateAudio() {
  console.log('🎤 生成语音...');
  const audioFiles = [];
  for (let i = 0; i < scenes.length; i++) {
    const mp3File = path.join(TEMP_DIR, `s${i}.mp3`);
    execSync(`python3 -m edge_tts --text "${scenes[i].narration}" --voice zh-CN-XiaoxiaoNeural --write-media "${mp3File}"`);
    const duration = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${mp3File}"`).toString().trim());
    audioFiles.push({ file: mp3File, duration });
    console.log(`  ${i + 1}. ${scenes[i].narration.substring(0, 20)}... (${duration.toFixed(1)}s)`);
  }
  
  // 拼接音频（含间隔静音）
  const listFile = path.join(TEMP_DIR, 'list.txt');
  let list = '';
  for (let i = 0; i < audioFiles.length; i++) {
    list += `file '${audioFiles[i].file}'\n`;
    if (i < audioFiles.length - 1) {
      const s = path.join(TEMP_DIR, `sil${i}.mp3`);
      execSync(`ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t ${GAP_BETWEEN_SCENES} -c:a libmp3lame -q:a 9 "${s}" 2>/dev/null`);
      list += `file '${s}'\n`;
    }
  }
  fs.writeFileSync(listFile, list);
  
  const merged = path.join(TEMP_DIR, 'audio.mp3');
  execSync(`ffmpeg -y -f concat -safe 0 -i "${listFile}" -c:a copy "${merged}" 2>/dev/null`);
  
  // 计算每个场景的起止时间点
  let t = 0;
  const timeline = audioFiles.map((a, i) => {
    const start = t;
    const end = t + a.duration;
    t = end + GAP_BETWEEN_SCENES;
    return { start, end, duration: a.duration };
  });
  
  const total = t - GAP_BETWEEN_SCENES; // 最后一个不需要间隔
  console.log(`  📊 总时长: ${total.toFixed(1)}s`);
  return { audioFile: merged, scenes: audioFiles, totalDuration: total, timeline };
}

async function recordDemo(audioData) {
  console.log('\n🎬 启动录制...');
  const server = await startServer();
  let browser, context, page, videoPath;
  
  try {
    browser = await chromium.launch({ 
      headless: false, 
      channel: 'chrome', 
      args: ['--start-maximized', '--no-sandbox', '--disable-infobars']
    });
    
    context = await browser.newContext({ 
      viewport: null,
      recordVideo: { dir: TEMP_DIR, size: { width: 1920, height: 1080 } },
      ignoreDefaultArgs: ['--enable-automation']
    });
    page = await context.newPage();
    page.setDefaultTimeout(30000);
    
    // 【关键】先显示开场画面，确保录制第一帧就有内容
    console.log('  📄 开场画面...');
    await page.goto(`file://${INTRO_FILE}`);
    await sleep(2000);
    
    // 加载应用
    console.log('  📄 加载应用...');
    await page.goto(`http://localhost:${PORT}/index.html`, { timeout: 30000, waitUntil: 'load' });
    await page.waitForSelector('#uploadPage', { state: 'visible', timeout: 15000 });
    await sleep(1000);
    console.log('  ✓ 就绪');
    
    // ===== 开始计时 =====
    const t0 = Date.now();
    const tl = audioData.timeline;
    
    // 场景 1：开场展示（只看页面）
    console.log(`\n  🎬 1/9 开场 [${tl[0].start.toFixed(1)}-${tl[0].end.toFixed(1)}s]`);
    await waitUntil(t0, tl[0].end + GAP_BETWEEN_SCENES);
    
    // 场景 2：上传 + 导航
    console.log(`  🎬 2/9 上传+导航 [${tl[1].start.toFixed(1)}-${tl[1].end.toFixed(1)}s]`);
    await page.click('#uploadArea');
    await sleep(200);
    await page.setInputFiles('#fileInput', path.join(BASE, 'scripts', 'test-data.xlsx'));
    await page.waitForFunction(() => document.getElementById('dashboard').style.display !== 'none', { timeout: 15000 });
    await sleep(1500);
    
    await page.locator('.nav-item').nth(2).click();
    await sleep(1500);
    await page.locator('.nav-item').nth(6).click();
    await sleep(1500);
    await page.locator('.nav-item').nth(0).click();
    
    await waitUntil(t0, tl[1].end + GAP_BETWEEN_SCENES);
    
    // 场景 3：表头激活/取消
    console.log(`  🎬 3/9 表头 [${tl[2].start.toFixed(1)}-${tl[2].end.toFixed(1)}s]`);
    await page.click('#addHeaderBtn');
    await sleep(600);
    await page.selectOption('#simpleQDropdown', { index: 1 });
    await sleep(500);
    await page.evaluate(() => document.querySelectorAll('#simpleOpts .picker-opt').forEach((o, i) => { if (i < 2) o.click(); }));
    await sleep(500);
    await page.click('#pickerConfirm');
    await sleep(1000);
    
    await page.locator('.hl-item').first().click();
    await sleep(1000);
    await page.locator('.hl-item').first().click();
    await sleep(1000);
    
    await waitUntil(t0, tl[2].end + GAP_BETWEEN_SCENES);
    
    // 场景 4：复杂表头
    console.log(`  🎬 4/9 复杂表头 [${tl[3].start.toFixed(1)}-${tl[3].end.toFixed(1)}s]`);
    await page.click('#addHeaderBtn');
    await sleep(500);
    await page.click('.picker-tab[data-tab="complex"]');
    await sleep(500);
    await page.evaluate(() => document.querySelectorAll('#complexOptsPicker .picker-opt').forEach((o, i) => { if (i === 0 || i === 2) o.click(); }));
    await sleep(600);
    await page.click('#addComplexGroup');
    await sleep(500);
    await page.locator('.complex-name-input').last().fill('合并选项');
    await sleep(300);
    await page.click('#pickerConfirm');
    await sleep(1000);
    
    await waitUntil(t0, tl[3].end + GAP_BETWEEN_SCENES);
    
    // 场景 5：显示设置
    console.log(`  🎬 5/9 显示设置 [${tl[4].start.toFixed(1)}-${tl[4].end.toFixed(1)}s]`);
    await page.click('[data-mode="both"]');
    await sleep(1200);
    await page.click('#diffToggle');
    await sleep(1200);
    await page.evaluate(() => { const r = document.getElementById('barWidthRange'); r.value = 22; r.dispatchEvent(new Event('input')); });
    await sleep(800);
    
    await waitUntil(t0, tl[4].end + GAP_BETWEEN_SCENES);
    
    // 场景 6：复制
    console.log(`  🎬 6/9 复制 [${tl[5].start.toFixed(1)}-${tl[5].end.toFixed(1)}s]`);
    await page.locator('.copy-btn').first().click();
    await sleep(1500);
    
    await waitUntil(t0, tl[5].end + GAP_BETWEEN_SCENES);
    
    // 场景 7：分组管理
    console.log(`  🎬 7/9 分组 [${tl[6].start.toFixed(1)}-${tl[6].end.toFixed(1)}s]`);
    await page.locator('.nav-item').nth(4).click();
    await sleep(800);
    
    await page.click('#addGroupBtn');
    await sleep(800);
    await page.locator('.nav-group-title .gt').last().dblclick();
    await sleep(400);
    await page.locator('.nav-group-title .gt[contenteditable]').fill('用户画像');
    await page.keyboard.press('Enter');
    await sleep(600);
    
    await page.click('#addGroupBtn');
    await sleep(600);
    await page.locator('.nav-group-title .gt').last().dblclick();
    await sleep(400);
    await page.locator('.nav-group-title .gt[contenteditable]').fill('满意度评价');
    await page.keyboard.press('Enter');
    await sleep(600);
    
    // 拖拽
    const g1 = page.locator('.nav-group-title').first();
    const g2 = page.locator('.nav-group-title').nth(1);
    const b1 = await g1.boundingBox();
    const b2 = await g2.boundingBox();
    if (b1 && b2) {
      await page.mouse.move(b1.x + b1.width / 2, b1.y + b1.height / 2);
      await page.mouse.down();
      await sleep(200);
      await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height + 20, { steps: 15 });
      await sleep(200);
      await page.mouse.up();
      await sleep(500);
    }
    
    await waitUntil(t0, tl[6].end + GAP_BETWEEN_SCENES);
    
    // 场景 8：夜览
    console.log(`  🎬 8/9 夜览 [${tl[7].start.toFixed(1)}-${tl[7].end.toFixed(1)}s]`);
    await page.click('#themeToggle');
    await sleep(2500);
    await page.click('#themeToggle');
    await sleep(2000);
    
    await waitUntil(t0, tl[7].end + GAP_BETWEEN_SCENES);
    
    // 场景 9：结尾
    console.log(`  🎬 9/9 结尾 [${tl[8].start.toFixed(1)}-${tl[8].end.toFixed(1)}s]`);
    await page.goto(`file://${OUTRO_FILE}`);
    await sleep(tl[8].duration * 1000 + 2000);
    
    console.log(`\n  ⏱️  录制: ${elapsed(t0).toFixed(1)}s`);
    console.log('  ✅ 完成');
    
    await sleep(2000);
    
  } finally {
    if (page) videoPath = await page.video().path();
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
    server.close();
  }
  return videoPath;
}

async function main() {
  console.log('🎬 数览 Sloth 视频生成器\n');
  
  if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true });
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  
  try {
    const audioData = await generateAudio();
    const videoPath = await recordDemo(audioData);
    
    if (!videoPath || !fs.existsSync(videoPath)) throw new Error('录制失败');
    
    console.log('\n🎥 合成视频...');
    const tempVideo = path.join(TEMP_DIR, 'temp.mp4');
    execSync(`ffmpeg -y -i "${videoPath}" -c:v libx264 -pix_fmt yuv420p -r 30 "${tempVideo}" 2>/dev/null`);
    execSync(`ffmpeg -y -i "${tempVideo}" -i "${audioData.audioFile}" -c:v copy -c:a aac -shortest "${OUTPUT}" 2>/dev/null`);
    
    console.log('\n✅ 完成！');
    console.log(`📁 ${OUTPUT}`);
    console.log(`⏱  音频: ${audioData.totalDuration.toFixed(1)}s`);
    console.log(`📊 ${(fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(1)} MB`);
    console.log(`🎬 1920x1080`);
  } finally {
    if (fs.existsSync(TEMP_DIR)) { fs.rmSync(TEMP_DIR, { recursive: true }); console.log('🧹 已清理'); }
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
