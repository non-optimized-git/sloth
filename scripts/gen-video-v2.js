const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..');
const TEMP_DIR = path.join(BASE, 'temp-video-gen');
const OUTPUT = path.join(BASE, 'docs', '数览Sloth-产品演示.mp4');

const scenes = [
  { narration: '欢迎使用数览，一款简洁优雅的问卷数据可视化工具。' },
  { narration: '上传Excel文件，数览会自动识别单选和多选题，瞬间生成交互式图表。' },
  { narration: '左侧导航支持搜索功能，可以快速定位任意一道题。' },
  { narration: '核心功能是表头交叉分析，图表变成多列并排对比，清晰展示数据差异。' },
  { narration: '显示设置支持切换数据格式、差异高亮、调节柱体粗细。' },
  { narration: '一键复制为表格，直接粘贴到飞书或Excel，格式完整保留。' },
  { narration: '支持题目分组、拖拽排序、夜览模式，还有自动保存功能。' },
  { narration: '数览，慢一点，看清数据。' }
];

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function generateAudio() {
  console.log('🎤 生成语音...');
  const audioFiles = [];
  for (let i = 0; i < scenes.length; i++) {
    const mp3File = path.join(TEMP_DIR, `scene-${i}.mp3`);
    execSync(`python3 -m edge_tts --text "${scenes[i].narration}" --voice zh-CN-XiaoxiaoNeural --write-media "${mp3File}"`);
    const duration = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${mp3File}"`).toString().trim());
    audioFiles.push({ file: mp3File, duration });
    console.log(`  ${i + 1}. ${scenes[i].narration.substring(0, 20)}... (${duration.toFixed(1)}s)`);
  }
  const concatFile = path.join(TEMP_DIR, 'concat.txt');
  fs.writeFileSync(concatFile, audioFiles.map(a => `file '${a.file}'`).join('\n'));
  const mergedAudio = path.join(TEMP_DIR, 'merged-audio.mp3');
  execSync(`ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c:a copy "${mergedAudio}" 2>/dev/null`);
  const totalDuration = audioFiles.reduce((sum, a) => sum + a.duration, 0);
  console.log(`  总时长: ${totalDuration.toFixed(1)}s`);
  return { audioFile: mergedAudio, scenes: audioFiles, totalDuration };
}

async function recordVideo(audioData) {
  console.log('\n🎬 启动浏览器录制...');
  
  // 启动本地服务器
  const http = require('http');
  const server = http.createServer((req, res) => {
    const filePath = path.join(BASE, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath);
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    try {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(8766, r));
  console.log('  🌐 本地服务器启动: http://localhost:8766');
  
  let browser, context, page, videoPath;
  
  try {
    browser = await chromium.launch({ 
      headless: false,  // 使用有头模式，方便调试
      channel: 'chrome',
      args: ['--window-size=1440,900']
    });
    
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { 
        dir: TEMP_DIR, 
        size: { width: 1440, height: 900 } 
      }
    });
    
    page = await context.newPage();
    console.log('  🖥️  浏览器已启动');
    
    // 加载页面
    await page.goto('http://localhost:8766/index.html', { timeout: 30000, waitUntil: 'networkidle' });
    console.log('  📄 页面已加载');
    await sleep(2000);
    
    // === 第 1 幕：开场 ===
    console.log(`  🎬 1/8 开场 (${audioData.scenes[0].duration.toFixed(1)}s)`);
    await sleep(audioData.scenes[0].duration * 1000);
    
    // === 第 2 幕：上传 ===
    console.log(`  🎬 2/8 上传 (${audioData.scenes[1].duration.toFixed(1)}s)`);
    await page.click('#uploadArea');
    await sleep(500);
    const fileInput = await page.$('#fileInput');
    await fileInput.setInputFiles(path.join(BASE, 'scripts', 'test-data.xlsx'));
    await page.waitForFunction(() => {
      const d = document.getElementById('dashboard');
      return d && d.style.display !== 'none';
    }, { timeout: 15000 });
    console.log('    ✓ 上传完成');
    await sleep(Math.max(2000, audioData.scenes[1].duration * 1000 - 1500));
    
    // === 第 3 幕：导航 ===
    console.log(`  🎬 3/8 导航 (${audioData.scenes[2].duration.toFixed(1)}s)`);
    const navItems = await page.$$('.nav-item');
    console.log(`    ✓ 找到 ${navItems.length} 个导航项`);
    if (navItems.length > 2) {
      await navItems[2].click();
      await sleep(1500);
    }
    if (navItems.length > 5) {
      await navItems[5].click();
      await sleep(1500);
    }
    // 搜索
    await page.fill('#searchInput', '满意');
    await sleep(1500);
    await page.fill('#searchInput', '');
    await sleep(1000);
    await sleep(Math.max(1000, audioData.scenes[2].duration * 1000 - 5000));
    
    // === 第 4 幕：表头 ===
    console.log(`  🎬 4/8 表头 (${audioData.scenes[3].duration.toFixed(1)}s)`);
    await page.click('#addHeaderBtn');
    await sleep(800);
    await page.selectOption('#simpleQDropdown', { index: 1 });
    await sleep(600);
    await page.evaluate(() => {
      const opts = document.querySelectorAll('#simpleOpts .picker-opt');
      if (opts.length > 0) opts[0].click();
      if (opts.length > 1) opts[1].click();
    });
    await sleep(800);
    await page.click('#pickerConfirm');
    console.log('    ✓ 表头已添加');
    await sleep(Math.max(2000, audioData.scenes[3].duration * 1000 - 3000));
    
    // === 第 5 幕：显示设置 ===
    console.log(`  🎬 5/8 显示设置 (${audioData.scenes[4].duration.toFixed(1)}s)`);
    await page.click('[data-mode="both"]');
    await sleep(1500);
    await page.click('#diffToggle');
    await sleep(1500);
    console.log('    ✓ 显示设置完成');
    await sleep(Math.max(1000, audioData.scenes[4].duration * 1000 - 3500));
    
    // === 第 6 幕：复制 ===
    console.log(`  🎬 6/8 复制 (${audioData.scenes[5].duration.toFixed(1)}s)`);
    const copyBtn = await page.$('.copy-btn');
    if (copyBtn) {
      await copyBtn.click();
      console.log('    ✓ 已复制');
    }
    await sleep(Math.max(2000, audioData.scenes[5].duration * 1000 - 500));
    
    // === 第 7 幕：分组与夜览 ===
    console.log(`  🎬 7/8 分组与夜览 (${audioData.scenes[6].duration.toFixed(1)}s)`);
    await page.click('#addGroupBtn');
    await sleep(1500);
    await page.click('#themeToggle');
    await sleep(2500);
    await page.click('#themeToggle');
    await sleep(1500);
    console.log('    ✓ 夜览模式测试完成');
    await sleep(Math.max(1000, audioData.scenes[6].duration * 1000 - 6000));
    
    // === 第 8 幕：结尾 ===
    console.log(`  🎬 8/8 结尾 (${audioData.scenes[7].duration.toFixed(1)}s)`);
    await page.evaluate(() => {
      document.body.innerHTML = `
        <div style="position:fixed;inset:0;background:linear-gradient(135deg,#f7f3ee 0%,#e8ddd0 100%);display:flex;flex-direction:column;align-items:center;justify-content:center">
          <div style="font-size:120px;margin-bottom:24px">🦥</div>
          <div style="font-size:48px;font-weight:700;color:#5c4a3a;margin-bottom:12px">数览 Sloth</div>
          <div style="font-size:24px;color:#5a7a4a">慢一点，看清数据</div>
          <div style="margin-top:30px;font-size:14px;color:#a89880">github.com/non-optimized-git/sloth</div>
        </div>
      `;
    });
    await sleep(audioData.scenes[7].duration * 1000);
    
    console.log('  ✅ 录制完成');
    
  } finally {
    // 重要：先获取视频路径，再关闭
    if (page) {
      videoPath = await page.video().path();
      console.log(`  📹 视频文件: ${videoPath}`);
    }
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
    server.close();
  }
  
  return videoPath;
}

async function main() {
  console.log('🎬 数览 Sloth 视频生成器 v2\n');
  
  if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true });
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  
  try {
    // 1. 生成语音
    const audioData = await generateAudio();
    
    // 2. 录制视频
    const videoPath = await recordVideo(audioData);
    
    if (!videoPath || !fs.existsSync(videoPath)) {
      throw new Error('视频录制失败');
    }
    
    // 3. 合成
    console.log('\n🎥 合成视频...');
    const tempVideo = path.join(TEMP_DIR, 'temp.mp4');
    execSync(`ffmpeg -y -i "${videoPath}" -c:v libx264 -pix_fmt yuv420p -r 30 "${tempVideo}" 2>/dev/null`);
    execSync(`ffmpeg -y -i "${tempVideo}" -i "${audioData.audioFile}" -c:v copy -c:a aac -shortest "${OUTPUT}" 2>/dev/null`);
    
    console.log('\n✅ 完成！');
    console.log(`📁 ${OUTPUT}`);
    console.log(`⏱  ${Math.floor(audioData.totalDuration / 60)}分${Math.floor(audioData.totalDuration % 60)}秒`);
    console.log(`📊 ${(fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(1)} MB`);
    
  } finally {
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true });
      console.log('🧹 临时文件已清理');
    }
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
