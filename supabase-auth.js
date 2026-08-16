/**
 * Supabase 认证模块 — 数览 Sloth
 * 
 * 提供邮箱登录/注册、OAuth 登录（Google/GitHub）、退出功能
 * 登录为可选功能，不登录也能使用原有功能
 */

const SlothAuth = (() => {
  let currentUser = null;
  let onAuthChange = null;

  // ── 初始化：监听认证状态 ───────────────────────
  async function init(authChangeCallback) {
    onAuthChange = authChangeCallback;

    // 获取当前会话
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session?.user || null;
    updateUI();
    // 初始加载时也调用回调
    if (onAuthChange) onAuthChange(currentUser);

    // 监听登录/退出事件
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      updateUI();
      if (onAuthChange) onAuthChange(currentUser);
    });
  }

  // ── 邮箱登录 ───────────────────────────────────
  async function signInWithEmail(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  }

  // ── 邮箱注册 ───────────────────────────────────
  async function signUpWithEmail(email, password) {
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) throw error;
    return data.user;
  }

  // ── OAuth 登录（Google / GitHub）──────────────
  async function signInWithOAuth(provider) {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) throw error;
  }

  // ── 退出 ───────────────────────────────────────
  async function signOut() {
    console.log("[SlothAuth] 尝试退出...");
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) {
        console.error("[SlothAuth] 退出失败:", error);
        alert("退出失败: " + error.message);
        throw error;
      }
      console.log("[SlothAuth] 退出成功");
    } catch (e) {
      console.error("[SlothAuth] 退出异常:", e);
      alert("退出异常: " + e.message);
    }
  }

  // ── 获取当前用户 ───────────────────────────────
  function getUser() { return currentUser; }
  function isLoggedIn() { return !!currentUser; }

  // ── UI 更新 ────────────────────────────────────
  function updateUI() {
    const name = currentUser ? (currentUser.user_metadata?.full_name
      || currentUser.user_metadata?.name
      || currentUser.email?.split('@')[0]
      || '用户') : '';

    // Dashboard header 用户栏
    const userBar = document.getElementById('slothUserBar');
    const loginBtn = document.getElementById('slothLoginBtn');
    const userInfo = document.getElementById('slothUserInfo');
    const userName = document.getElementById('slothUserName');
    if (userBar) {
      if (currentUser) {
        loginBtn.style.display = 'none';
        userInfo.style.display = 'flex';
        userName.textContent = name;
      } else {
        loginBtn.style.display = 'inline-flex';
        userInfo.style.display = 'none';
      }
    }

    // 上传页顶部栏
    const uploadLoginBtn = document.getElementById('uploadLoginBtn');
    const uploadUserInfo = document.getElementById('uploadUserInfo');
    const uploadUserName = document.getElementById('uploadUserName');
    if (uploadLoginBtn) {
      if (currentUser) {
        uploadLoginBtn.style.display = 'none';
        uploadUserInfo.style.display = 'flex';
        uploadUserName.textContent = currentUser.email || '用户';
      } else {
        uploadLoginBtn.style.display = 'inline-flex';
        uploadUserInfo.style.display = 'none';
      }
    }

    // 文件页用户名
    const filesPageUserName = document.getElementById('filesPageUserName');
    if (filesPageUserName && currentUser) {
      filesPageUserName.textContent = currentUser.email || '用户';
    }
  }

  // ── 弹窗控制 ────────────────────────────────────
  function openLoginModal() {
    const modal = document.getElementById('slothLoginModal');
    if (modal) modal.classList.remove('hidden');
    // 默认显示登录 tab
    switchAuthTab('login');
  }
  function closeLoginModal() {
    const modal = document.getElementById('slothLoginModal');
    if (modal) modal.classList.add('hidden');
    clearAuthError();
  }

  function switchAuthTab(tab) {
    document.querySelectorAll('.sauth-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.sauth-tab[data-tab="${tab}"]`)?.classList.add('active');
    document.getElementById('sauthLoginForm').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('sauthSignupForm').style.display = tab === 'signup' ? 'block' : 'none';
    clearAuthError();
  }

  function showAuthError(msg) {
    const el = document.getElementById('sauthError');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }
  function clearAuthError() {
    const el = document.getElementById('sauthError');
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  }

  // ── 绑定事件 ────────────────────────────────────
  function bindEvents() {
    // 打开登录弹窗
    document.getElementById('slothLoginBtn')?.addEventListener('click', openLoginModal);

    // 关闭弹窗
    document.getElementById('sauthClose')?.addEventListener('click', closeLoginModal);
    document.getElementById('slothLoginModal')?.addEventListener('click', e => {
      if (e.target.id === 'slothLoginModal') closeLoginModal();
    });

    // Tab 切换
    document.querySelectorAll('.sauth-tab').forEach(tab => {
      tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
    });

    // 邮箱登录
    document.getElementById('sauthLoginSubmit')?.addEventListener('click', async () => {
      const email = document.getElementById('sauthLoginEmail').value.trim();
      const pwd = document.getElementById('sauthLoginPwd').value;
      if (!email || !pwd) { showAuthError('请填写邮箱和密码'); return; }
      try {
        await signInWithEmail(email, pwd);
        closeLoginModal();
      } catch (e) { showAuthError(e.message || '登录失败'); }
    });

    // 邮箱注册
    document.getElementById('sauthSignupSubmit')?.addEventListener('click', async () => {
      const email = document.getElementById('sauthSignupEmail').value.trim();
      const pwd = document.getElementById('sauthSignupPwd').value;
      if (!email || !pwd) { showAuthError('请填写邮箱和密码'); return; }
      if (pwd.length < 6) { showAuthError('密码至少 6 位'); return; }
      try {
        await signUpWithEmail(email, pwd);
        showAuthError('注册成功！如需邮箱验证请查看收件箱。');
      } catch (e) { showAuthError(e.message || '注册失败'); }
    });

    // OAuth 按钮
    document.getElementById('sauthGoogle')?.addEventListener('click', () => signInWithOAuth('google'));
    document.getElementById('sauthGitHub')?.addEventListener('click', () => signInWithOAuth('github'));

    // 退出
    document.getElementById('slothLogoutBtn')?.addEventListener('click', async () => {
      await signOut();
    });
  }

  return { init, getUser, isLoggedIn, signOut, bindEvents, openLoginModal, closeLoginModal };
})();
