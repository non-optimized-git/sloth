/**
 * Supabase 配置文件 — 数览 Sloth
 * 
 * 使用前请替换以下占位符为你的 Supabase 项目真实凭证：
 *   - YOUR_SUPABASE_URL
 *   - sb_publishable_hqTwaAFAFyFyyZzxr0yfeQ_hYNEbZ5T
 * 
 * 获取方式：Supabase Dashboard → Settings → API
 */

const SUPABASE_URL = 'https://dijrslohfqreirdrjbry.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hqTwaAFAFyFyyZzxr0yfeQ_hYNEbZ5T';

// Storage bucket 名称
const STORAGE_BUCKET = 'sloth-files';

// 文件大小限制 (20MB)
const MAX_FILE_SIZE = 20 * 1024 * 1024;

// 初始化 Supabase 客户端（全局）
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
