# 数览 Sloth — 产品开发指南

## 产品简介

数览 Sloth 是一个纯前端问卷数据可视化工具，用户上传 Excel 文件后自动生成交互式柱状图，支持交叉分析、分组管理、夜览模式等功能。

- **定位**：数据分析工具，非问卷收集工具
- **技术栈**：单文件 HTML + ECharts 5.5 + XLSX.js + CSS 自定义属性
- **风格**：暖棕色MUJI风，克制、安静、易用

## 项目结构

```
survey-dashboard/
├── index.html              # 📊 主产品（单文件，~62KB）
├── CLAUDE.md               # 📖 开发指南（本文件）
├── CHANGELOG.md            # 📝 版本更新记录
├── SECURITY.md             # 🔐 安全指南
├── package.json            # 📦 npm 配置
├── playwright.config.js    # 🧪 测试配置
│
├── docs/                   # 📚 文档
│   ├── PRD.md              #    产品需求文档
│   ├── README.md           #    项目说明
│   ├── video-script.md     #    视频脚本
│   └── 数览Sloth-产品演示.mp4 #  产品演示视频
│
├── scripts/                # 🔧 工具脚本
│   ├── gen-video.js        #    视频生成（Playwright + Edge TTS）
│   ├── gen-test-data.js    #    测试数据生成
│   └── test-data.xlsx      #    测试问卷（337条，26题）
│
├── tests/                  # 🧪 测试用例
│   └── survey.spec.js      #    27个测试
│
└── test-results/           # 🧪 测试结果
```

## 代码架构（index.html）

### CSS 设计系统（1-300行）

- **设计令牌**：`--c-*`（颜色）、`--t*`（文字）、`--f-*`（字号）、`--radius-*`（圆角）
- **亮色主题**：`:root` 变量
- **暗色主题**：`[data-theme="dark"]` 变量，0.4s 过渡动画
- **组件类**：`.btn`、`.segmented`、`.toggle-row`、`.modal`

### HTML 结构（250-390行）

- **上传页**：`#uploadPage` — 拖拽上传区域
- **仪表盘**：`#dashboard`
  - `.header` — 顶部 Banner（44px高）
  - `.sidebar` — 左侧题目导航
  - `.main` — 中间图表区域
  - `.toolbox` — 右侧设置面板
- **弹窗**：表头选择器、编辑表头、确认对话框

### JavaScript 核心状态

```javascript
let rawData = [];           // Excel 原始数据
let questions = [];         // 解析后的题目数组（跳过空列）
let headers = [];           // Excel 列名数组（所有列）
let groups = [];            // 分组配置
let headerLibrary = [];     // 表头库
let activeHeaderIds = new Set(); // 当前激活的表头 ID
let hiddenQuestions = new Set(); // 被隐藏的题目索引
let displayMode = 'percent'; // 数据格式：percent/count/both
let decimalPlaces = 0;      // 小数位数：0/1/2
let showDiff = false;       // 差异高亮
let barMaxWidth = 16;       // 柱体粗细
let currentTheme = 'light'; // 主题
```

### 核心函数

| 函数 | 作用 |
|------|------|
| `parseExcel()` | 解析 Excel，自动识别单选/多选，过滤空列，自动隐藏高基数题目 |
| `computeSubset(qIdx, filterFn)` | 计算子集数据（使用 `questions[qIdx].title` 作为列名） |
| `buildFilter(hdr)` | 构建表头过滤器（使用 `questions[f.questionIdx].title` 作为列名） |
| `renderAll()` | = `renderSidebar()` + `renderMain()` + `renderHeaderLib()` |
| `renderCharts()` | 用 ECharts 渲染图表 |
| `copyQuestionData(qi)` | 复制为 Markdown 表格 |
| `openHeaderPicker()` | 打开表头选择器 |
| `openEditHeader(idx)` | 编辑表头 |
| `sanitizeFileName(name)` | 清理文件名，替换非 ASCII 字符为下划线 |

### ECharts 图表配置

- **主题颜色**：用 `getCSS('--bar-color')` 获取（不支持 CSS 变量）
- **动画**：从上到下加载 `animationDelay: idx => (revLabels.length-1-idx)*35`
- **柱体**：圆角 `[0,5,5,0]`，宽度固定 `barWidth: barMaxWidth`（所有柱体粗细一致）
- **每题独立比例尺**：不统一 xMax

## 常见修改场景

### 修改颜色/样式

1. CSS 变量在 `:root` 和 `[data-theme="dark"]`
2. ECharts 颜色用 `getCSS()` 函数获取
3. 表头样式和 Total 保持一致（棕色，无边框）

### 添加新功能

1. HTML 结构加到 `#dashboard` 区域
2. 样式加到 CSS 区域
3. JS 逻辑加到对应区域
4. 更新 `renderAll()` 如果需要刷新显示

### 修改显示设置

- 默认值在 JS 顶部：`displayMode='percent'`, `decimalPlaces=0`
- HTML 默认激活状态要对应

### 数据索引注意事项

**重要**：`headers` 数组和 `questions` 数组索引不一致！
- `headers`：包含 Excel 所有列名（包括空列）
- `questions`：只包含有数据的列（跳过空列）

**正确用法**：
```javascript
// ✅ 正确：使用 question.title 作为列名
const colName = questions[qIdx].title;
const value = row[colName];

// ❌ 错误：使用索引访问 headers
const value = row[headers[qIdx]]; // 可能索引错位！
```

### Supabase 集成

- 配置文件：`supabase-config.js`（已在 .gitignore）
- 认证：`supabase-auth.js`（SlothAuth 对象）
- 存储：`supabase-storage.js`（SlothStorage 对象）
- 文件路径：`{user_id}/{timestamp}_{filename}`

### 修改视频

1. 编辑 `gen-video.js` 中的 `scenes` 数组
2. 每个场景有 `narration`（语音）和操作代码
3. 运行 `node gen-video.js` 生成视频
4. 依赖：Playwright + Edge TTS（`pip3 install edge-tts`）

## 测试

```bash
# 安装依赖
npm install

# 运行测试
npx playwright test

# 测试用例在 tests/survey.spec.js，共 27 个
```

## 设计原则

1. **暖色系**：棕色为主，绿色点缀
2. **安静克制**：不抢用户注意力
3. **即时反馈**：设置改动实时生效
4. **一致性**：同类元素样式统一
5. **可访问性**：夜览模式、键盘导航
