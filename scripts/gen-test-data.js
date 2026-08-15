const XLSX = require('xlsx');
const path = require('path');

// 生成测试数据
const data = [];
const headers = ['ID', '性别', '年龄', '购买渠道', '购买频率', '单次消费金额', '最常购买的水果', '满意度'];

// 添加表头
data.push(headers);

// 生成 50 条测试数据
const genders = ['男', '女'];
const ages = ['18-25岁', '26-35岁', '36-45岁', '46岁以上'];
const channels = ['超市/卖场', '线上平台', '水果专卖店', '社区团购', '路边摊'];
const frequencies = ['每天', '每周2-3次', '每周1次', '每月2-3次', '每月1次以下'];
const amounts = ['50元以下', '50-100元', '100-200元', '200-300元', '300元以上'];
const fruits = ['苹果', '香蕉', '橙子', '葡萄', '草莓', '西瓜', '芒果'];
const satisfactions = ['非常满意', '满意', '一般', '不满意', '非常不满意'];

for (let i = 1; i <= 50; i++) {
  data.push([
    i,
    genders[Math.floor(Math.random() * genders.length)],
    ages[Math.floor(Math.random() * ages.length)],
    channels[Math.floor(Math.random() * channels.length)],
    frequencies[Math.floor(Math.random() * frequencies.length)],
    amounts[Math.floor(Math.random() * amounts.length)],
    fruits[Math.floor(Math.random() * fruits.length)],
    satisfactions[Math.floor(Math.random() * satisfactions.length)]
  ]);
}

// 创建工作簿
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(data);
XLSX.utils.book_append_sheet(wb, ws, '问卷数据');

// 保存
const outputPath = path.join(__dirname, 'test-data.xlsx');
XLSX.writeFile(wb, outputPath);
console.log('✅ 测试数据已生成:', outputPath);
