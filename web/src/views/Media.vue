<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../api';
import type { MediaPlatform, MediaAccount, MediaFile, MediaPublishTask } from '../types';

// ===== 标签页 =====
type TabKey = 'accounts' | 'materials' | 'publish' | 'records';
// 直连本地 Python 微服务(默认 localhost:5409),绕过服务器 Node 桥接
const MEDIA_URL = (window as any).__MEDIA_URL__ || 'http://localhost:5409';

const activeTab = ref<TabKey>('accounts');
const tabs: { key: TabKey; label: string }[] = [
  { key: 'accounts', label: '账号管理' },
  { key: 'materials', label: '素材管理' },
  { key: 'publish', label: '发布中心' },
  { key: 'records', label: '发布记录' },
];

// ===== 平台数据 =====
const platforms = ref<MediaPlatform[]>([]);
const platformMap = computed(() => {
  const m = new Map<number, MediaPlatform>();
  platforms.value.forEach(p => m.set(p.type, p));
  return m;
});

onMounted(() => {
  loadPlatforms();
  loadAccounts();
  loadFiles();
  loadTasks();
});

async function loadPlatforms() {
  try {
    platforms.value = await api.mediaPlatforms();
  } catch (e: any) {
    console.error('加载平台列表失败:', e.message);
  }
}

// =============================================================
// 标签页1: 账号管理
// =============================================================
const accounts = ref<MediaAccount[]>([]);
const accountsLoading = ref(false);
const showAddAccountDialog = ref(false);
const addForm = ref({ type: 0, userName: '' });
const loggingIn = ref(false);
const loginStatus = ref('');
let loginEventSource: EventSource | null = null;

async function loadAccounts() {
  accountsLoading.value = true;
  try {
    accounts.value = await api.mediaAccounts();
  } catch (e: any) {
    console.error('加载账号失败:', e.message);
  } finally {
    accountsLoading.value = false;
  }
}

function openAddDialog() {
  addForm.value = { type: 0, userName: '' };
  loginStatus.value = '';
  showAddAccountDialog.value = true;
}

function startLogin() {
  if (!addForm.value.type || !addForm.value.userName) {
    alert('请选择平台并填写账号名');
    return;
  }
  loggingIn.value = true;
  loginStatus.value = '正在启动登录流程...';

  // 直连本地 Python 微服务的 SSE 登录流
  const url = `${MEDIA_URL}/login/stream?type=${addForm.value.type}&id=${encodeURIComponent(addForm.value.userName)}`;

  fetch(url).then(async resp => {
    if (!resp.ok) {
      loginStatus.value = '启动登录失败: ' + resp.statusText;
      loggingIn.value = false;
      return;
    }
    if (!resp.body) return;
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const line = chunk.split('\n').find(l => l.startsWith('data: '));
        if (!line) continue;
        try {
          const data = JSON.parse(line.slice(6));
          loginStatus.value = data.msg || JSON.stringify(data);
          if (data.code === 200 && data.msg?.includes('登录成功')) {
            setTimeout(() => {
              loggingIn.value = false;
              showAddAccountDialog.value = false;
              loadAccounts();
            }, 1000);
          }
        } catch {}
      }
    }
    loggingIn.value = false;
  }).catch(err => {
    loginStatus.value = '连接错误: ' + err.message;
    loggingIn.value = false;
  });
}

function stopLogin() {
  if (loginEventSource) {
    loginEventSource.close();
    loginEventSource = null;
  }
  loggingIn.value = false;
}

async function verifyAccount(id: number) {
  try {
    const r = await api.mediaVerifyAccount(id);
    alert(r.valid ? '账号有效' : '账号已失效，请重新登录');
    loadAccounts();
  } catch (e: any) {
    alert('验证失败: ' + e.message);
  }
}

async function deleteAccountRow(id: number) {
  if (!confirm('确定要删除这个账号吗？')) return;
  try {
    await api.mediaDeleteAccount(id);
    loadAccounts();
  } catch (e: any) {
    alert('删除失败: ' + e.message);
  }
}

function getPlatformName(type: number) {
  return platformMap.value.get(type)?.name || `平台${type}`;
}

function getStatusLabel(status: number) {
  return status === 1 ? '有效' : '失效';
}

// =============================================================
// 标签页2: 素材管理
// =============================================================
const files = ref<MediaFile[]>([]);
const filesLoading = ref(false);
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.multiple = true;
const uploading = ref(false);

async function loadFiles() {
  filesLoading.value = true;
  try {
    files.value = await api.mediaFiles();
  } catch (e: any) {
    console.error('加载素材失败:', e.message);
  } finally {
    filesLoading.value = false;
  }
}

function triggerUpload() {
  fileInput.click();
}

fileInput.addEventListener('change', async () => {
  if (!fileInput.files || fileInput.files.length === 0) return;
  uploading.value = true;
  try {
    for (let i = 0; i < fileInput.files.length; i++) {
      const file = fileInput.files[i];
      const formData = new FormData();
      formData.append('file', file);
      // 显式传原始文件名,避免 Werkzeug multipart 对中文文件名的 latin-1 误解码
      formData.append('filename', file.name);

      const resp = await fetch(`${MEDIA_URL}/files/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        alert(`上传 ${file.name} 失败: ${err.error || resp.statusText}`);
      }
    }
    loadFiles();
  } finally {
    uploading.value = false;
    fileInput.value = '';
  }
});

async function deleteFileRow(id: number) {
  if (!confirm('确定要删除这个素材吗？')) return;
  try {
    await api.mediaDeleteFile(id);
    loadFiles();
  } catch (e: any) {
    alert('删除失败: ' + e.message);
  }
}

function formatFileSize(mb: number) {
  if (mb < 1) return `${(mb * 1024).toFixed(0)} KB`;
  return `${mb.toFixed(2)} MB`;
}

// =============================================================
// 标签页3: 发布中心
// =============================================================
const selectedFileIds = ref<number[]>([]);
const selectedPlatforms = ref<number[]>([]);
const publishTitle = ref('');
const publishText = ref('');
const publishTags = ref('');
const enableTimer = ref(false);
const publishTime = ref('');
const publishing = ref(false);

const availableAccounts = computed(() => {
  // 状态为有效的账号，按平台分组
  const groups: Record<number, MediaAccount[]> = {};
  accounts.value.forEach(a => {
    if (a.status === 1) {
      if (!groups[a.type]) groups[a.type] = [];
      groups[a.type].push(a);
    }
  });
  return groups;
});

const selectedAccounts = ref<Record<number, number[]>>({}); // platformType -> accountIds

function togglePlatform(type: number) {
  const idx = selectedPlatforms.value.indexOf(type);
  if (idx >= 0) {
    selectedPlatforms.value.splice(idx, 1);
    delete selectedAccounts.value[type];
  } else {
    selectedPlatforms.value.push(type);
    selectedAccounts.value[type] = [];
  }
}

function toggleAccount(platformType: number, accountId: number) {
  if (!selectedAccounts.value[platformType]) selectedAccounts.value[platformType] = [];
  const list = selectedAccounts.value[platformType];
  const idx = list.indexOf(accountId);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(accountId);
}

const canPublish = computed(() => {
  if (selectedFileIds.value.length === 0) return false;
  if (selectedPlatforms.value.length === 0) return false;
  // 每个选中的平台至少选一个账号
  for (const ptype of selectedPlatforms.value) {
    if (!selectedAccounts.value[ptype] || selectedAccounts.value[ptype].length === 0) return false;
  }
  return true;
});

async function doPublish() {
  if (!canPublish.value) {
    alert('请选择素材、平台和账号');
    return;
  }
  if (!confirm('确定要发布吗？')) return;

  publishing.value = true;
  try {
    // 构造单平台单文件发布（先简单实现：每个文件每个平台每个账号都调一次）
    // 更完整的批量发布走 batch 接口
    const selectedFiles = files.value.filter(f => selectedFileIds.value.includes(f.id));
    // 传 fileId 而非文件名:后端按 id 从数据库查真实 file_path,避免中文文件名传输乱码
    const fileList = selectedFiles.map(f => ({ fileId: f.id }));
    // 根据素材类型自动判断: 图片=图文(1), 视频=视频(2)
    const isImage = selectedFiles.every(f => f.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i));
    const fileType = isImage ? 1 : 2;

    for (const ptype of selectedPlatforms.value) {
      const acctIds = selectedAccounts.value[ptype] || [];
      const acctList = accounts.value
        .filter(a => acctIds.includes(a.id))
        .map(a => ({ filePath: a.filePath, userName: a.userName }));

      await api.mediaPublishSingle({
        type: ptype,
        accountList: acctList,
        fileType,
        fileList,
        title: publishTitle.value,
        text: publishText.value,
        tags: publishTags.value,
      });
    }

    alert('发布任务已提交！');
    activeTab.value = 'records';
    loadTasks();
  } catch (e: any) {
    alert('发布失败: ' + e.message);
  } finally {
    publishing.value = false;
  }
}

function toggleFileSelect(id: number) {
  const idx = selectedFileIds.value.indexOf(id);
  if (idx >= 0) selectedFileIds.value.splice(idx, 1);
  else selectedFileIds.value.push(id);
}

// =============================================================
// 标签页4: 发布记录
// =============================================================
const tasks = ref<MediaPublishTask[]>([]);
const tasksTotal = ref(0);
const tasksPage = ref(1);
const tasksPageSize = ref(10);
const tasksLoading = ref(false);
const taskStatusFilter = ref('');
const taskPlatformFilter = ref('');

async function loadTasks() {
  tasksLoading.value = true;
  try {
    const r = await api.mediaTasks({
      page: tasksPage.value,
      page_size: tasksPageSize.value,
      status: taskStatusFilter.value || undefined,
      platform_name: taskPlatformFilter.value || undefined,
    });
    tasks.value = r.records;
    tasksTotal.value = r.total;
  } catch (e: any) {
    console.error('加载发布记录失败:', e.message);
  } finally {
    tasksLoading.value = false;
  }
}

const statusOptions = [
  { value: '', label: '全部状态' },
  { value: '待发布', label: '待发布' },
  { value: '发布中', label: '发布中' },
  { value: '发布成功', label: '发布成功' },
  { value: '发布失败', label: '发布失败' },
  { value: '已取消', label: '已取消' },
];

function getStatusClass(status: string) {
  switch (status) {
    case '发布成功': return 'status-success';
    case '发布失败': return 'status-failed';
    case '发布中': return 'status-running';
    case '已取消': return 'status-cancelled';
    default: return 'status-pending';
  }
}

async function cancelTask(id: number) {
  if (!confirm('确定取消这个任务吗？')) return;
  try {
    await api.mediaCancelTask(id);
    loadTasks();
  } catch (e: any) {
    alert('取消失败: ' + e.message);
  }
}

async function retryTask(id: number) {
  if (!confirm('确定重试这个任务吗？')) return;
  try {
    await api.mediaRetryTask(id);
    loadTasks();
  } catch (e: any) {
    alert('重试失败: ' + e.message);
  }
}

async function deleteTask(id: number) {
  if (!confirm('确定删除这条记录吗？')) return;
  try {
    await api.mediaDeleteTask(id);
    loadTasks();
  } catch (e: any) {
    alert('删除失败: ' + e.message);
  }
}

function prevPage() {
  if (tasksPage.value > 1) { tasksPage.value--; loadTasks(); }
}
function nextPage() {
  if (tasksPage.value * tasksPageSize.value < tasksTotal.value) { tasksPage.value++; loadTasks(); }
}
</script>

<template>
  <div class="od-media">
    <!-- 页头 -->
    <div class="page-head">
      <h1 class="page-title">媒体发布</h1>
      <p class="page-sub">多平台自媒体内容一键发布，支持账号管理、素材上传、定时发布</p>
    </div>

    <!-- 标签页 -->
    <div class="tabs">
      <button
        v-for="t in tabs" :key="t.key"
        class="tab-btn"
        :class="{ active: activeTab === t.key }"
        @click="activeTab = t.key"
      >{{ t.label }}</button>
    </div>

    <!-- 内容区 -->
    <div class="tab-content">

      <!-- ===== 账号管理 ===== -->
      <div v-if="activeTab === 'accounts'" class="accounts-panel">
        <div class="panel-head">
          <div class="panel-title">账号列表 ({{ accounts.length }})</div>
          <button class="btn-primary" @click="openAddDialog">+ 添加账号</button>
        </div>

        <div v-if="accountsLoading" class="loading">加载中...</div>
        <div v-else-if="accounts.length === 0" class="empty">
          暂无账号，点击右上角「添加账号」开始添加
        </div>
        <div v-else class="account-list">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>平台</th>
                <th>账号名</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in accounts" :key="a.id">
                <td>{{ a.id }}</td>
                <td>{{ getPlatformName(a.type) }}</td>
                <td>{{ a.userName }}</td>
                <td>
                  <span class="status-badge" :class="a.status === 1 ? 'status-success' : 'status-failed'">
                    {{ getStatusLabel(a.status) }}
                  </span>
                </td>
                <td class="actions">
                  <button class="btn-link" @click="verifyAccount(a.id)">验证</button>
                  <button class="btn-link danger" @click="deleteAccountRow(a.id)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ===== 素材管理 ===== -->
      <div v-if="activeTab === 'materials'" class="materials-panel">
        <div class="panel-head">
          <div class="panel-title">素材库 ({{ files.length }})</div>
          <button class="btn-primary" @click="triggerUpload" :disabled="uploading">
            {{ uploading ? '上传中...' : '+ 上传素材' }}
          </button>
        </div>

        <div v-if="filesLoading" class="loading">加载中...</div>
        <div v-else-if="files.length === 0" class="empty">
          暂无素材，点击右上角「上传素材」开始上传
        </div>
        <div v-else class="file-grid">
          <div v-for="f in files" :key="f.id" class="file-card" :class="{ selected: selectedFileIds.includes(f.id) }"
               @click="toggleFileSelect(f.id)">
            <button class="file-del" title="删除素材" @click.stop="deleteFileRow(f.id)">×</button>
            <div class="file-thumb">
              <video v-if="f.filename.match(/\.(mp4|mov|avi|mkv|webm)$/i)" :src="f.url" muted preload="metadata"></video>
              <img v-else-if="f.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)" :src="f.url" :alt="f.filename" loading="lazy" />
              <div v-else class="file-icon">📄</div>
            </div>
            <div class="file-info">
              <div class="file-name" :title="f.filename">{{ f.filename }}</div>
              <div class="file-meta">{{ formatFileSize(f.filesize) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 发布中心 ===== -->
      <div v-if="activeTab === 'publish'" class="publish-panel">
        <div class="publish-layout">
          <!-- 左：选择素材 -->
          <div class="publish-section">
            <h3 class="section-title">选择素材</h3>
            <div v-if="files.length === 0" class="empty-small">请先到「素材管理」上传素材</div>
            <div v-else class="file-select-list">
              <label v-for="f in files.slice(0, 20)" :key="f.id" class="file-select-item">
                <input type="checkbox" :checked="selectedFileIds.includes(f.id)" @change="toggleFileSelect(f.id)" />
                <span class="file-name-sm">{{ f.filename }}</span>
                <span class="file-size-sm">{{ formatFileSize(f.filesize) }}</span>
              </label>
            </div>
          </div>

          <!-- 中：选择平台和账号 -->
          <div class="publish-section">
            <h3 class="section-title">选择平台与账号</h3>
            <div v-if="platforms.length === 0" class="empty-small">加载平台中...</div>
            <div v-else class="platform-list">
              <div v-for="p in platforms" :key="p.type" class="platform-item">
                <label class="platform-check">
                  <input type="checkbox" :checked="selectedPlatforms.includes(p.type)" @change="togglePlatform(p.type)" />
                  <strong>{{ p.name }}</strong>
                </label>
                <div v-if="selectedPlatforms.includes(p.type)" class="account-sublist">
                  <div v-if="!availableAccounts[p.type]?.length" class="empty-small">暂无有效账号</div>
                  <label v-for="a in availableAccounts[p.type]" :key="a.id" class="account-check">
                    <input type="checkbox"
                      :checked="selectedAccounts[p.type]?.includes(a.id)"
                      @change="toggleAccount(p.type, a.id)" />
                    {{ a.userName }}
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- 右：发布信息 -->
          <div class="publish-section">
            <h3 class="section-title">发布信息</h3>
            <div class="form-group">
              <label>标题</label>
              <input v-model="publishTitle" type="text" class="form-input" placeholder="请输入标题" />
            </div>
            <div class="form-group">
              <label>正文描述</label>
              <textarea v-model="publishText" class="form-textarea" rows="5" placeholder="请输入正文描述"></textarea>
            </div>
            <div class="form-group">
              <label>标签（逗号分隔）</label>
              <input v-model="publishTags" type="text" class="form-input" placeholder="标签1, 标签2" />
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="enableTimer" />
                定时发布
              </label>
              <input v-if="enableTimer" v-model="publishTime" type="datetime-local" class="form-input" />
            </div>
          </div>
        </div>

        <div class="publish-footer">
          <div class="publish-info">
            已选 <strong>{{ selectedFileIds.length }}</strong> 个素材，
            <strong>{{ selectedPlatforms.length }}</strong> 个平台
          </div>
          <button class="btn-primary large" :disabled="!canPublish || publishing" @click="doPublish">
            {{ publishing ? '发布中...' : '立即发布' }}
          </button>
        </div>
      </div>

      <!-- ===== 发布记录 ===== -->
      <div v-if="activeTab === 'records'" class="records-panel">
        <div class="panel-head">
          <div class="panel-title">发布记录 ({{ tasksTotal }})</div>
          <div class="filter-bar">
            <select v-model="taskStatusFilter" class="form-select" @change="tasksPage=1; loadTasks()">
              <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
            <button class="btn-secondary" @click="loadTasks">刷新</button>
          </div>
        </div>

        <div v-if="tasksLoading" class="loading">加载中...</div>
        <div v-else-if="tasks.length === 0" class="empty">暂无发布记录</div>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>文件</th>
              <th>平台</th>
              <th>账号</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in tasks" :key="t.id">
              <td>{{ t.id }}</td>
              <td class="td-ellipsis" :title="t.filename">{{ t.filename }}</td>
              <td>{{ t.platform_name }}</td>
              <td>{{ t.account_name }}</td>
              <td>
                <span class="status-badge" :class="getStatusClass(t.status)">{{ t.status }}</span>
              </td>
              <td>{{ t.create_time }}</td>
              <td class="actions">
                <button v-if="t.status === '待发布' || t.status === '发布中'"
                        class="btn-link" @click="cancelTask(t.id)">取消</button>
                <button v-if="t.status === '发布失败'"
                        class="btn-link" @click="retryTask(t.id)">重试</button>
                <button class="btn-link danger" @click="deleteTask(t.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="tasksTotal > 0" class="pagination">
          <button class="btn-secondary" :disabled="tasksPage <= 1" @click="prevPage">上一页</button>
          <span class="page-info">第 {{ tasksPage }} 页 / 共 {{ Math.ceil(tasksTotal / tasksPageSize) }} 页</span>
          <button class="btn-secondary" :disabled="tasksPage * tasksPageSize >= tasksTotal" @click="nextPage">下一页</button>
        </div>
      </div>

    </div>

    <!-- 添加账号弹窗 -->
    <div v-if="showAddAccountDialog" class="dialog-mask" @click.self="showAddAccountDialog = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3>添加账号</h3>
          <button class="btn-close" @click="showAddAccountDialog = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>选择平台</label>
            <select v-model.number="addForm.type" class="form-select" :disabled="loggingIn">
              <option :value="0">请选择平台</option>
              <option v-for="p in platforms" :key="p.type" :value="p.type">{{ p.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>账号名</label>
            <input v-model="addForm.userName" type="text" class="form-input" placeholder="请输入账号名" :disabled="loggingIn" />
          </div>
          <div v-if="loggingIn || loginStatus" class="login-status">
            <div class="status-title">登录状态</div>
            <div class="status-text">{{ loginStatus }}</div>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn-secondary" @click="showAddAccountDialog = false" :disabled="loggingIn">取消</button>
          <button v-if="!loggingIn" class="btn-primary" @click="startLogin" :disabled="!addForm.type || !addForm.userName">
            开始登录
          </button>
          <button v-else class="btn-secondary" @click="stopLogin">停止</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 令牌 --od-* 为全局,定义于 styles\tokens.css */
.od-media {
  font-family: var(--od-font-sans);
  background: var(--od-bg);
  color: var(--od-text);
  min-height: 100%;
}

.page-head {
  margin-bottom: var(--od-space-5);
}
.page-title {
  font-size: var(--od-text-2xl);
  font-weight: var(--od-weight-bold);
  margin: 0 0 var(--od-space-2);
  color: var(--od-text);
}
.page-sub {
  font-size: var(--od-text-sm);
  color: var(--od-text-muted);
  margin: 0;
}

/* 标签页 */
.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--od-border);
  margin-bottom: var(--od-space-5);
}
.tab-btn {
  padding: var(--od-space-3) var(--od-space-5);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--od-text-muted);
  font-size: var(--od-text-base);
  font-weight: var(--od-weight-medium);
  cursor: pointer;
  font-family: inherit;
  transition: all .15s ease;
}
.tab-btn:hover { color: var(--od-text); }
.tab-btn.active {
  color: var(--od-primary);
  border-bottom-color: var(--od-primary);
}

.tab-content { min-height: 400px; }

/* 面板头 */
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--od-space-4);
}
.panel-title {
  font-size: var(--od-text-lg);
  font-weight: var(--od-weight-semibold);
  color: var(--od-text);
}

/* 按钮 */
.btn-primary {
  padding: 8px 16px;
  background: var(--od-primary);
  color: white;
  border: none;
  border-radius: var(--od-radius-md);
  font-size: var(--od-text-sm);
  font-weight: var(--od-weight-medium);
  cursor: pointer;
  font-family: inherit;
  transition: background .15s ease;
}
.btn-primary:hover:not(:disabled) { background: var(--od-primary-hover); }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; }
.btn-primary.large { padding: 10px 24px; font-size: var(--od-text-base); }

.btn-secondary {
  padding: 6px 14px;
  background: var(--od-surface-2);
  color: var(--od-text);
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius-md);
  font-size: var(--od-text-sm);
  cursor: pointer;
  font-family: inherit;
  transition: all .15s ease;
}
.btn-secondary:hover:not(:disabled) {
  border-color: var(--od-primary);
  color: var(--od-primary);
}
.btn-secondary:disabled { opacity: .5; cursor: not-allowed; }

.btn-link {
  background: none;
  border: none;
  color: var(--od-primary);
  font-size: var(--od-text-sm);
  cursor: pointer;
  font-family: inherit;
  padding: 4px 8px;
}
.btn-link:hover { text-decoration: underline; }
.btn-link.danger { color: var(--od-danger); }

/* 表格 */
.data-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--od-surface);
  border-radius: var(--od-radius-md);
  overflow: hidden;
}
.data-table th {
  text-align: left;
  padding: 12px 16px;
  background: var(--od-surface-2);
  font-size: var(--od-text-sm);
  font-weight: var(--od-weight-semibold);
  color: var(--od-text-muted);
  border-bottom: 1px solid var(--od-border);
}
.data-table td {
  padding: 12px 16px;
  font-size: var(--od-text-sm);
  border-bottom: 1px solid var(--od-border);
  color: var(--od-text);
}
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover td { background: var(--od-surface-2); }
.td-ellipsis {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.actions {
  display: flex;
  gap: 4px;
}

/* 状态标签 */
.status-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: var(--od-radius-full);
  font-size: var(--od-text-xs);
  font-weight: var(--od-weight-medium);
}
.status-success { background: var(--od-success-soft); color: var(--od-success); }
.status-failed { background: var(--od-danger-soft); color: var(--od-danger); }
.status-running { background: var(--od-primary-soft); color: var(--od-primary); }
.status-pending { background: var(--od-surface-2); color: var(--od-text-muted); }
.status-cancelled { background: var(--od-surface-2); color: var(--od-text-muted); }

/* 加载/空态 */
.loading, .empty {
  padding: 48px;
  text-align: center;
  color: var(--od-text-muted);
  font-size: var(--od-text-sm);
}
.empty-small {
  padding: 16px;
  text-align: center;
  color: var(--od-text-muted);
  font-size: var(--od-text-sm);
}

/* 素材网格 */
.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--od-space-4);
}
.file-card {
  position: relative;
  background: var(--od-surface);
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius-md);
  overflow: hidden;
  cursor: pointer;
  transition: all .15s ease;
}
.file-card:hover { border-color: var(--od-primary); }
.file-del {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  display: none;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border: none;
  border-radius: var(--od-radius-full);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  z-index: 2;
}
.file-card:hover .file-del { display: flex; }
.file-del:hover { background: var(--od-danger); }
.file-card.selected {
  border-color: var(--od-primary);
  box-shadow: 0 0 0 2px var(--od-primary-soft);
}
.file-thumb {
  width: 100%;
  height: 120px;
  background: var(--od-surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.file-thumb video, .file-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.file-icon { font-size: 32px; }
.file-info {
  padding: 10px 12px;
}
.file-name {
  font-size: var(--od-text-sm);
  color: var(--od-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}
.file-meta {
  font-size: var(--od-text-xs);
  color: var(--od-text-muted);
}

/* 发布布局 */
.publish-layout {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--od-space-5);
  margin-bottom: var(--od-space-5);
}
@media (max-width: 1200px) {
  .publish-layout { grid-template-columns: 1fr; }
}
.publish-section {
  background: var(--od-surface);
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius-md);
  padding: var(--od-space-5);
}
.section-title {
  font-size: var(--od-text-base);
  font-weight: var(--od-weight-semibold);
  color: var(--od-text);
  margin: 0 0 var(--od-space-4);
}

/* 表单 */
.form-group {
  margin-bottom: var(--od-space-4);
}
.form-group label {
  display: block;
  font-size: var(--od-text-sm);
  font-weight: var(--od-weight-medium);
  color: var(--od-text);
  margin-bottom: 6px;
}
.form-input, .form-select, .form-textarea {
  width: 100%;
  padding: 8px 12px;
  background: var(--od-surface);
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius-md);
  color: var(--od-text);
  font-size: var(--od-text-sm);
  font-family: inherit;
  box-sizing: border-box;
  transition: border-color .15s ease;
}
.form-input:focus, .form-select:focus, .form-textarea:focus {
  outline: none;
  border-color: var(--od-primary);
}
.form-textarea { resize: vertical; }
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: var(--od-weight-normal);
  cursor: pointer;
}

/* 平台列表 */
.platform-item {
  margin-bottom: var(--od-space-3);
  padding-bottom: var(--od-space-3);
  border-bottom: 1px solid var(--od-border);
}
.platform-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
.platform-check {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: var(--od-text-sm);
}
.account-sublist {
  margin-top: 8px;
  padding-left: 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.account-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--od-text-sm);
  color: var(--od-text-muted);
  cursor: pointer;
}

/* 素材选择列表 */
.file-select-list {
  max-height: 400px;
  overflow-y: auto;
}
.file-select-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--od-radius-sm);
  cursor: pointer;
  font-size: var(--od-text-sm);
}
.file-select-item:hover { background: var(--od-surface-2); }
.file-name-sm { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size-sm { color: var(--od-text-muted); font-size: var(--od-text-xs); }

/* 发布底部 */
.publish-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--od-space-4);
  background: var(--od-surface);
  border: 1px solid var(--od-border);
  border-radius: var(--od-radius-md);
}
.publish-info { font-size: var(--od-text-sm); color: var(--od-text-muted); }
.publish-info strong { color: var(--od-primary); }

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--od-space-4);
  margin-top: var(--od-space-5);
}
.page-info {
  font-size: var(--od-text-sm);
  color: var(--od-text-muted);
}

/* 筛选栏 */
.filter-bar {
  display: flex;
  gap: var(--od-space-3);
  align-items: center;
}

/* 弹窗 */
.dialog-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.dialog {
  background: var(--od-surface);
  border-radius: var(--od-radius-lg);
  width: 480px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--od-shadow-lg);
}
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--od-space-5);
  border-bottom: 1px solid var(--od-border);
}
.dialog-header h3 {
  margin: 0;
  font-size: var(--od-text-lg);
  font-weight: var(--od-weight-semibold);
  color: var(--od-text);
}
.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--od-text-muted);
  cursor: pointer;
  line-height: 1;
  padding: 4px;
}
.btn-close:hover { color: var(--od-text); }
.dialog-body {
  padding: var(--od-space-5);
  overflow-y: auto;
  flex: 1;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--od-space-3);
  padding: var(--od-space-5);
  border-top: 1px solid var(--od-border);
}

/* 登录状态 */
.login-status {
  margin-top: var(--od-space-4);
  padding: var(--od-space-4);
  background: var(--od-surface-2);
  border-radius: var(--od-radius-md);
}
.status-title {
  font-size: var(--od-text-sm);
  font-weight: var(--od-weight-semibold);
  color: var(--od-text);
  margin-bottom: 8px;
}
.status-text {
  font-size: var(--od-text-sm);
  color: var(--od-text-muted);
  word-break: break-all;
  line-height: 1.6;
}
</style>
