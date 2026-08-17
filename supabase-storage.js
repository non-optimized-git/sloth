/**
 * Supabase 文件管理模块 — 数览 Sloth
 * 
 * 功能：文件上传 / 下载 / 删除 / 列表
 * 前提：用户已登录（SlothAuth.isLoggedIn() === true）
 * 文件大小限制：20MB（由 supabase-config.js 定义）
 */

const SlothStorage = (() => {

  // ── 文件名安全化：只保留字母数字连字符下划线句点 ──
  function sanitizeFileName(name) {
    // 提取扩展名
    const lastDot = name.lastIndexOf('.');
    const baseName = lastDot > 0 ? name.substring(0, lastDot) : name;
    const ext = lastDot > 0 ? name.substring(lastDot) : '';
    // 替换不安全字符（只保留 ASCII 字母、数字、连字符、下划线）
    const safe = baseName.replace(/[^a-zA-Z0-9\-_]/g, '_');
    // 去除连续下划线和首尾下划线
    const cleaned = safe.replace(/_+/g, '_').replace(/^_|_$/g, '');
    // 如果清理后为空，使用时间戳
    return (cleaned || Date.now().toString()) + ext;
  }

  // ── 上传文件 ───────────────────────────────────
  async function uploadFile(file) {
    if (!SlothAuth.isLoggedIn()) throw new Error('请先登录');
    if (file.size > MAX_FILE_SIZE) throw new Error(`文件大小不能超过 ${MAX_FILE_SIZE / 1024 / 1024}MB`);

    const user = SlothAuth.getUser();
    const ext = file.name.split('.').pop();
    const timestamp = Date.now();
    // 存储路径：{user_id}/{timestamp}_{safe_name}
    const safeName = sanitizeFileName(file.name);
    const filePath = `${user.id}/${timestamp}_${safeName}`;

    // 1. 上传到 Storage
    const { error: uploadError } = await supabaseClient.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, { upsert: false });
    if (uploadError) throw uploadError;

    // 2. 记录元数据到 files 表
    const { error: dbError } = await supabaseClient
      .from('files')
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type || `application/${ext}`,
      });
    if (dbError) throw dbError;

    return { path: filePath, name: file.name, size: file.size };
  }

  // ── 获取用户文件列表 ───────────────────────────
  async function listFiles() {
    if (!SlothAuth.isLoggedIn()) throw new Error('请先登录');

    const { data, error } = await supabaseClient
      .from('files')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  // ── 下载文件 ───────────────────────────────────
  async function downloadFile(filePath, fileName) {
    if (!SlothAuth.isLoggedIn()) throw new Error('请先登录');

    const { data, error } = await supabaseClient.storage
      .from(STORAGE_BUCKET)
      .download(filePath);
    if (error) throw error;

    // 触发浏览器下载
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || filePath.split('/').pop();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── 删除文件 ───────────────────────────────────
  async function deleteFile(fileId, filePath) {
    if (!SlothAuth.isLoggedIn()) throw new Error('请先登录');

    // 1. 从 Storage 删除
    const { error: storageError } = await supabaseClient.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);
    if (storageError) throw storageError;

    // 2. 从 files 表删除
    const { error: dbError } = await supabaseClient
      .from('files')
      .delete()
      .eq('id', fileId);
    if (dbError) throw dbError;
  }

  // ── 获取公开 URL（用于预览）────────────────────
  function getPublicUrl(filePath) {
    const { data } = supabaseClient.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);
    return data?.publicUrl;
  }

  // ── 格式化文件大小 ─────────────────────────────
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  return { uploadFile, listFiles, downloadFile, deleteFile, getPublicUrl, formatSize };
})();
