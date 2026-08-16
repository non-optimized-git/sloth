-- ══════════════════════════════════════════════════════
-- 数览 Sloth — Supabase 数据库表结构
-- 
-- 执行方式：
--   1. Supabase Dashboard → SQL Editor
--   2. 粘贴以下内容并执行
-- 
-- 前提：
--   - 已在 Storage 中创建 bucket "sloth-files"
--   - bucket 设为 private（不公开）
-- ══════════════════════════════════════════════════════

-- ── files 表：存储文件元数据 ───────────────────────
CREATE TABLE IF NOT EXISTS public.files (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,                      -- 原始文件名
  file_path   TEXT NOT NULL UNIQUE,                -- Storage 中的路径
  file_size   BIGINT NOT NULL DEFAULT 0,           -- 文件大小（字节）
  file_type   TEXT DEFAULT '',                      -- MIME 类型
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_files_user_id ON public.files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON public.files(created_at DESC);

-- ── 自动更新 updated_at ───────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_files_updated ON public.files;
CREATE TRIGGER on_files_updated
  BEFORE UPDATE ON public.files
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ── 启用 RLS ─────────────────────────────────────
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- ── RLS 策略：用户只能操作自己的文件 ─────────────
-- 查看
CREATE POLICY "Users can view own files"
  ON public.files FOR SELECT
  USING (auth.uid() = user_id);

-- 插入
CREATE POLICY "Users can insert own files"
  ON public.files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 更新
CREATE POLICY "Users can update own files"
  ON public.files FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 删除
CREATE POLICY "Users can delete own files"
  ON public.files FOR DELETE
  USING (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════
-- Storage RLS 策略（在 Supabase Dashboard → Storage → Policies 中设置）
-- 或执行以下 SQL：
-- ══════════════════════════════════════════════════════

-- 允许已认证用户上传到自己的目录
CREATE POLICY "Authenticated users can upload own files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'sloth-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 允许已认证用户查看自己的文件
CREATE POLICY "Authenticated users can view own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'sloth-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 允许已认证用户删除自己的文件
CREATE POLICY "Authenticated users can delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'sloth-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
