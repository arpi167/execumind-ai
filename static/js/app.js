/**
 * ExecuMind AI – Frontend Application Logic
 * Fixed: double-init, sendChat naming, robust fetch error handling
 */

// ─── STATE ────────────────────────────────────────────────────────────────────
const state = {
  tasks: JSON.parse(localStorage.getItem('em_tasks') || '[]'),
  xp: parseInt(localStorage.getItem('em_xp') || '0'),
  streak: parseInt(localStorage.getItem('em_streak') || '0'),
  badges: JSON.parse(localStorage.getItem('em_badges') || '[]'),
  chatHistory: [],
  lastDate: localStorage.getItem('em_lastdate') || ''
};

const XP_MAP = { high: 40, med: 20, low: 10 };

const BADGE_DEFS = [
  { id: 'first',   icon: '🌟', name: 'First Step',    desc: 'Complete your first task',        req: s => s.tasks.filter(t => t.done).length >= 1 },
  { id: 'five',    icon: '🔥', name: 'On Fire',        desc: 'Complete 5 tasks',                req: s => s.tasks.filter(t => t.done).length >= 5 },
  { id: 'ten',     icon: '💎', name: 'Diamond Mind',   desc: 'Complete 10 tasks',               req: s => s.tasks.filter(t => t.done).length >= 10 },
  { id: 'streak3', icon: '⚡', name: 'Momentum',       desc: '3-day streak',                    req: s => s.streak >= 3 },
  { id: 'streak7', icon: '🏆', name: 'Week Warrior',   desc: '7-day streak',                    req: s => s.streak >= 7 },
  { id: 'xp500',   icon: '🚀', name: 'XP Rocket',      desc: 'Earn 500 XP',                     req: s => s.xp >= 500 },
  { id: 'xp1000',  icon: '👑', name: 'King of Focus',  desc: 'Earn 1000 XP',                    req: s => s.xp >= 1000 },
  { id: 'planner', icon: '📐', name: 'Master Planner', desc: 'Add 5+ tasks',                    req: s => s.tasks.length >= 5 },
  { id: 'highpri', icon: '🎯', name: 'Precision',      desc: 'Complete 3 high-priority tasks',  req: s => s.tasks.filter(t => t.done && t.priority === 'high').length >= 3 },
];

const LEVEL_DEFS = [
  { lvl: 1, title: 'Novice Executor',  xp: 500 },
  { lvl: 2, title: 'Task Handler',     xp: 1200 },
  { lvl: 3, title: 'Focus Builder',    xp: 2500 },
  { lvl: 4, title: 'Deep Worker',      xp: 4000 },
  { lvl: 5, title: 'Elite Executor',   xp: 6000 },
  { lvl: 6, title: 'Mind Master',      xp: 9000 },
  { lvl: 7, title: 'ExecuMind Elite',  xp: Infinity },
];

// ─── INIT (called ONCE via DOMContentLoaded) ──────────────────────────────────
function init() {
  const now = new Date();
  const dateEl = document.getElementById('dateChip');
  if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  });

  // Streak logic
  const today = now.toDateString();
  if (state.lastDate !== today) {
    const yesterday = new Date(now - 86400000).toDateString();
    if (state.lastDate === yesterday) state.streak++;
    else if (state.lastDate !== today) state.streak = 1;
    state.lastDate = today;
    saveState();
  }

  renderAll();
  drawWeekChart();
  renderBadges();
  checkBackend();

  // Wire up chat controls
  const sendBtn = document.getElementById('chatSend');
  if (sendBtn) sendBtn.onclick = sendChat;

  const chatInput = document.getElementById('chatInput');
  if (chatInput) chatInput.addEventListener('keydown', handleChatKey);
}

function saveState() {
  localStorage.setItem('em_tasks', JSON.stringify(state.tasks));
  localStorage.setItem('em_xp', state.xp);
  localStorage.setItem('em_streak', state.streak);
  localStorage.setItem('em_badges', JSON.stringify(state.badges));
  localStorage.setItem('em_lastdate', state.lastDate);
}

function renderAll() {
  renderStats();
  renderDashTasks();
  renderTaskQueue();
  renderTracker();
  renderRewards();
  updateContextSnap();
  checkBadges();
}

// ─── BACKEND CHECK ────────────────────────────────────────────────────────────
async function checkBackend() {
  const indicator = document.getElementById('apiStatus');
  if (!indicator) return;
  try {
    const res = await fetch('/');
    indicator.className = res.ok ? 'api-status ok' : 'api-status err';
    indicator.title = res.ok ? 'Backend connected ✓' : 'Backend error';
  } catch {
    indicator.className = 'api-status err';
    indicator.title = 'Backend offline';
  }
}

// ─── API HELPER ───────────────────────────────────────────────────────────────
async function apiPost(endpoint, body) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s hard timeout

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('Invalid JSON from server');
    }

    if (!res.ok) throw new Error(json.error || 'Server error ' + res.status);
    return json;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error('Request timed out');
    throw err;
  }
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function switchTab(id, el) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  el.classList.add('active');
  const titles = {
    dashboard: 'Dashboard', planner: 'Task Planner',
    tracker: 'Execution Tracker', rewards: 'Rewards & Badges', assistant: 'AI Mentor'
  };
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = titles[id] || id;
  if (id === 'tracker') renderTracker();
  if (id === 'rewards') { renderRewards(); renderBadges(); }
}

// ─── STATS ────────────────────────────────────────────────────────────────────
function renderStats() {
  const total = state.tasks.length;
  const done  = state.tasks.filter(t => t.done).length;
  const pct   = total ? Math.round(done / total * 100) : 0;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('stat-total', total);
  set('stat-done', done);
  set('stat-xp', state.xp);
  set('stat-pct', pct + '% done');
  set('stat-focus', pct ? pct + '%' : '—');
  set('stat-total-change', total ? `${done} of ${total} complete` : 'Add your first task');
  set('streakCount', state.streak);

  const lvl = getLevelInfo();
  set('ss-level', lvl.current.lvl);
  set('ss-xp', lvl.xpInLevel + ' / ' + (lvl.current.xp === Infinity ? '∞' : lvl.current.xp));
  const xpBar = document.getElementById('ss-xp-bar');
  if (xpBar) xpBar.style.width = Math.min(100, lvl.pct) + '%';
}

function getLevelInfo() {
  let xpBase = 0;
  for (let i = 0; i < LEVEL_DEFS.length; i++) {
    const current = LEVEL_DEFS[i];
    const nextXP  = current.xp;
    if (i === LEVEL_DEFS.length - 1 || state.xp < xpBase + nextXP) {
      const xpInLevel = state.xp - xpBase;
      const pct = nextXP === Infinity ? 99 : Math.round(xpInLevel / nextXP * 100);
      return { current, xpInLevel, pct };
    }
    xpBase += nextXP;
  }
  return { current: LEVEL_DEFS[LEVEL_DEFS.length - 1], xpInLevel: 0, pct: 100 };
}

// ─── TASK MANAGEMENT ──────────────────────────────────────────────────────────
function addTask() {
  const titleEl = document.getElementById('taskTitle');
  const title   = titleEl ? titleEl.value.trim() : '';
  if (!title) { showToast('Please enter a task title'); return; }

  const task = {
    id: Date.now(),
    title,
    priority: document.getElementById('taskPriority')?.value || 'med',
    duration:  document.getElementById('taskDuration')?.value  || '30',
    category:  document.getElementById('taskCategory')?.value  || 'work',
    done: false,
    createdAt: new Date().toISOString()
  };

  state.tasks.unshift(task);
  saveState();
  if (titleEl) titleEl.value = '';
  renderAll();
  showToast('Task added ✨');
}

function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;
  const xp = XP_MAP[task.priority] || 20;
  if (task.done) {
    state.xp += xp;
    state.streak = Math.max(state.streak, 1);
    showXPPopup(xp);
  } else {
    state.xp = Math.max(0, state.xp - xp);
  }
  saveState();
  renderAll();
  checkBadges();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveState();
  renderAll();
}

function getSortedTasks() {
  const priScore = { high: 3, med: 2, low: 1 };
  return [...state.tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (priScore[b.priority] || 1) - (priScore[a.priority] || 1);
  });
}

const CAT_ICONS = { work: '💼', learning: '📚', health: '💪', personal: '🏠', creative: '🎨' };

function renderTaskItem(task, hideActions = false) {
  const xp = XP_MAP[task.priority] || 20;
  return `<div class="task-item ${task.done ? 'done' : ''}">
    <div class="task-check ${task.done ? 'checked' : ''}" onclick="toggleTask(${task.id})"></div>
    <div style="flex:1;min-width:0">
      <div class="task-title" style="${task.done ? 'text-decoration:line-through' : ''}">${task.title}</div>
      <div class="task-meta">
        <span class="badge ${task.priority}">${task.priority.toUpperCase()}</span>
        <span class="task-time">${task.duration}min</span>
        <span class="tag">${CAT_ICONS[task.category] || '📌'} ${task.category}</span>
        <span class="task-xp">+${xp} XP</span>
      </div>
    </div>
    ${!hideActions ? `<div class="task-actions"><button class="btn-icon" onclick="deleteTask(${task.id})">✕</button></div>` : ''}
  </div>`;
}

function renderDashTasks() {
  const el = document.getElementById('dashTaskList');
  if (!el) return;
  const tasks = getSortedTasks().slice(0, 6);
  if (!tasks.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><h3>No tasks yet</h3><p>Head to Planner to create your first task</p></div>';
    return;
  }
  el.innerHTML = tasks.map(t => renderTaskItem(t, true)).join('');
}

function renderTaskQueue() {
  const tasks = getSortedTasks();
  const el    = document.getElementById('taskQueue');
  const sub   = document.getElementById('taskQueueSub');
  if (sub) sub.textContent = tasks.length + ' tasks';
  if (!el) return;
  if (!tasks.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">✨</div><h3>Queue empty</h3><p>Add your first task above</p></div>';
    return;
  }
  el.innerHTML = tasks.map(t => renderTaskItem(t)).join('');
}

// ─── DECISION ENGINE (/analyze) ───────────────────────────────────────────────
async function runDecisionEngine() {
  if (!state.tasks.length) { showToast('Add tasks first!'); return; }
  const panel = document.getElementById('decisionPanel');
  if (!panel) return;
  panel.innerHTML = '<div class="ai-thinking"><div class="spinner"></div> Running decision engine…</div>';

  try {
    const data = await apiPost('/analyze', { tasks: state.tasks, xp: state.xp, streak: state.streak });
    if (!data.success) throw new Error(data.error || 'Analyze failed');
    const d = data.data;
    const scores = d.score || {};

    panel.innerHTML = `
      <div class="decision-item">
        <div class="decision-label">🎯 Focus Task Now</div>
        <div class="decision-value" style="color:var(--accent2);font-weight:700">${d.focus_task || '—'}</div>
        <div style="font-size:12px;color:var(--text3);margin-top:4px">${d.focus_reason || ''}</div>
      </div>
      <div class="decision-item">
        <div class="decision-label">⚡ Strategy</div>
        <div class="decision-value">${d.execution_strategy || '—'}</div>
      </div>
      ${d.risk_flag ? `<div class="decision-item" style="border-color:rgba(248,113,113,0.3);background:rgba(248,113,113,0.05)">
        <div class="decision-label" style="color:var(--coral)">⚠️ Risk Flag</div>
        <div class="decision-value" style="color:var(--coral)">${d.risk_flag}</div>
      </div>` : ''}
      <div class="decision-item">
        <div class="decision-label">💡 Energy Tip</div>
        <div class="decision-value">${d.energy_tip || '—'}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:4px">
        ${Object.entries(scores).map(([k, v]) => `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center">
          <div style="font-family:var(--font-head);font-size:18px;font-weight:800;color:var(--accent2)">${v}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">${k.replace(/_/g,' ')}</div>
        </div>`).join('')}
      </div>`;
  } catch (e) {
    panel.innerHTML = `<div style="color:var(--coral);font-size:13px;padding:12px">⚠️ ${e.message}</div>`;
  }
}

// ─── NLP ENGINE (/nlp) ────────────────────────────────────────────────────────
async function processNLP() {
  const inputEl = document.getElementById('nlpInput');
  const text = inputEl ? inputEl.value.trim() : '';
  if (!text) { showToast('Enter some text to parse'); return; }

  const btn = document.getElementById('nlpBtn');
  const out = document.getElementById('nlpOutput');
  if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Parsing…'; }
  if (out) { out.style.display = 'block'; out.style.color = 'var(--text3)'; out.textContent = 'AI is structuring your thoughts…'; }

  try {
    const data = await apiPost('/nlp', { text });
    if (!data.success) throw new Error(data.error || 'NLP failed');

    const tasks = data.tasks || [];
    let output = `✅ Extracted ${data.count} task${data.count !== 1 ? 's' : ''}\n\n`;
    tasks.forEach((t, i) => {
      output += `${i + 1}. [${(t.priority || 'med').toUpperCase()}] ${t.title}\n`;
      output += `   📁 ${t.category} | ⏱ ${t.duration}min | 💡 ${t.reasoning}\n\n`;
    });
    if (data.strategy) output += `\n📌 Strategy: ${data.strategy}`;
    if (data.warnings?.length) output += `\n\n⚠️ ${data.warnings.join('\n⚠️ ')}`;
    if (data.estimated_total_hours) output += `\n\n⏰ Total estimated: ${data.estimated_total_hours}h`;

    if (out) { out.style.color = 'var(--text)'; out.textContent = output; }

    tasks.forEach(t => {
      const pri = t.priority === 'medium' ? 'med' : (t.priority || 'med');
      state.tasks.unshift({
        id: Date.now() + Math.random(),
        title: t.title,
        priority: ['high', 'med', 'low'].includes(pri) ? pri : 'med',
        duration: String(t.duration || 30),
        category: t.category || 'work',
        done: false,
        createdAt: new Date().toISOString()
      });
    });

    saveState();
    renderAll();
    if (tasks.length) showToast(`✨ ${tasks.length} task${tasks.length !== 1 ? 's' : ''} extracted & added!`);

  } catch (e) {
    if (out) { out.style.color = 'var(--coral)'; out.textContent = '⚠️ ' + e.message; }
  }

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Parse with AI`;
  }
}

// ─── SCHEDULE GENERATOR (/plan) ───────────────────────────────────────────────
async function generateSchedule() {
  if (!state.tasks.length) { showToast('Add tasks first!'); return; }
  const el = document.getElementById('scheduleWrap');
  if (!el) return;
  el.innerHTML = '<div class="ai-thinking"><div class="spinner"></div> Generating schedule…</div>';

  try {
    const data = await apiPost('/plan', { tasks: state.tasks, start_time: '9:00 AM', work_hours: 8 });
    if (!data.success) throw new Error(data.error || 'Plan failed');

    const blocks = data.schedule || [];
    if (!blocks.length) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">📅</div><h3>No schedule generated</h3></div>';
      return;
    }

    const typeLabels = { focus: '🧠 Deep Work', break: '☕ Break', review: '📊 Review' };
    el.innerHTML = blocks.map(b => {
      const typeClass = b.type || 'focus';
      return `<div class="time-block">
        <div class="time-label">${b.time || ''}</div>
        <div class="time-content">
          <div class="time-block-item ${typeClass}">
            <div class="tbi-title">${typeLabels[typeClass] || typeClass} · ${b.title || ''}</div>
            ${b.note ? `<div class="tbi-meta">${b.note}</div>` : ''}
            ${b.tasks?.length ? `<div class="tbi-tasks">${b.tasks.join(' · ')}</div>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = `<div style="color:var(--coral);font-size:13px;padding:12px">⚠️ ${e.message}</div>`;
  }
}

// ─── TRACKER ──────────────────────────────────────────────────────────────────
function renderTracker() {
  const total     = state.tasks.length;
  const done      = state.tasks.filter(t => t.done).length;
  const pct       = total ? Math.round(done / total * 100) : 0;
  const focusMins = state.tasks.filter(t => t.done).reduce((a, t) => a + parseInt(t.duration || 30), 0);

  const setBar = (id, w) => {
    const el = document.getElementById(id);
    if (el) el.style.width = w + '%';
  };
  const setText = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };

  setText('tr-rate', pct + '%');
  setBar('tr-rate-bar', pct);
  setText('tr-hours', (focusMins / 60).toFixed(1) + 'h');
  setBar('tr-hours-bar', Math.min(100, focusMins / 480 * 100));
  setText('tr-xp-total', state.xp);
  setBar('tr-xp-bar', Math.min(100, state.xp / 1000 * 100));

  const exec  = pct;
  const cons  = Math.min(100, state.streak * 15);
  const plan  = total ? Math.min(100, 60 + pct * 0.4) : 0;
  const focus = done  ? Math.min(100, 50 + done * 5)  : 0;
  [['exec', exec], ['cons', cons], ['plan', plan], ['focus', focus]].forEach(([k, v]) => {
    setBar('bm-' + k, v);
    setText('bm-' + k + '-s', Math.round(v) + '%');
  });

  const hist = document.getElementById('allTasks');
  const hCount = document.getElementById('historyCount');
  if (hCount) hCount.textContent = total + ' total';
  if (hist) {
    hist.innerHTML = total
      ? getSortedTasks().map(t => renderTaskItem(t)).join('')
      : '<div class="empty"><div class="empty-icon">📊</div><h3>No history</h3><p>Complete tasks to build your record</p></div>';
  }
}

// ─── BEHAVIOR ANALYSIS (/behavior) ────────────────────────────────────────────
async function analyzeBehavior() {
  const loading = document.getElementById('behaviorLoading');
  const text    = document.getElementById('behaviorText');
  const gradeEl = document.getElementById('gradeDisplay');
  if (loading) loading.style.display = 'flex';
  if (text)    text.style.display = 'none';
  if (gradeEl) gradeEl.innerHTML = '';

  try {
    const data = await apiPost('/behavior', { tasks: state.tasks, xp: state.xp, streak: state.streak });
    if (!data.success) throw new Error(data.error || 'Behavior analysis failed');
    const d = data.data;

    if (d.scores) {
      const s = d.scores;
      [['exec', s.execution], ['cons', s.consistency], ['plan', s.planning_accuracy], ['focus', s.focus_depth]].forEach(([k, v]) => {
        if (v !== undefined) {
          const bar = document.getElementById('bm-' + k);
          const score = document.getElementById('bm-' + k + '-s');
          if (bar)   bar.style.width   = v + '%';
          if (score) score.textContent = v + '%';
        }
      });
    }

    const gradeClass = { A: 'grade-a', B: 'grade-b', C: 'grade-c', D: 'grade-d', F: 'grade-f' }[d.overall_grade] || 'grade-c';
    if (gradeEl) gradeEl.innerHTML = `<span class="tag-grade ${gradeClass}">${d.overall_grade || '—'}</span>`;

    if (loading) loading.style.display = 'none';
    if (text) {
      text.style.display = 'block';
      text.innerHTML = `
        <div style="margin-bottom:10px"><strong style="color:var(--green)">✅ Strength:</strong> ${d.strength || '—'}</div>
        <div style="margin-bottom:10px"><strong style="color:var(--coral)">🔧 Fix:</strong> ${d.fix || '—'}</div>
        <div><strong style="color:var(--amber)">📌 Tomorrow:</strong> ${d.action || '—'}</div>
      `;
    }
  } catch (e) {
    if (loading) loading.style.display = 'none';
    if (text)  { text.style.display = 'block'; text.innerHTML = `<span style="color:var(--coral)">⚠️ ${e.message}</span>`; }
  }
}

// ─── REWARDS ──────────────────────────────────────────────────────────────────
function renderRewards() {
  const lvl = getLevelInfo();
  const set  = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('levelNum',   lvl.current.lvl);
  set('levelTitle', lvl.current.title);
  set('levelXP',    lvl.xpInLevel + ' / ' + (lvl.current.xp === Infinity ? '∞' : lvl.current.xp) + ' XP to next level');
  const lb = document.getElementById('levelBar');
  if (lb) lb.style.width = Math.min(100, lvl.pct) + '%';

  const ring = document.getElementById('ringProgress');
  if (ring) {
    const circumference = 245;
    ring.style.strokeDashoffset = circumference - (Math.min(100, lvl.pct) / 100 * circumference);
  }

  const done = state.tasks.filter(t => t.done).length;
  set('rew-streak', state.streak);
  set('rew-tasks',  done);
  set('rew-xp',     state.xp);
  set('rew-badges', state.badges.length);
}

function renderBadges() {
  const el = document.getElementById('badgeGrid');
  if (!el) return;
  el.innerHTML = BADGE_DEFS.map(b => {
    const earned = state.badges.includes(b.id);
    return `<div class="badge-card">
      <div class="badge-icon ${earned ? '' : 'locked'}" style="background:${earned ? 'rgba(124,106,255,0.2)' : 'var(--bg3)'}">${b.icon}</div>
      <div class="badge-name" style="${earned ? '' : 'color:var(--text3)'}">${b.name}</div>
      <div class="badge-desc">${b.desc}</div>
      <div class="badge-earned" style="${earned ? '' : 'color:var(--text3)'}">${earned ? '✓ Earned' : 'Locked'}</div>
    </div>`;
  }).join('');
}

function checkBadges() {
  let newBadge = false;
  BADGE_DEFS.forEach(b => {
    if (!state.badges.includes(b.id) && b.req(state)) {
      state.badges.push(b.id);
      showToast(`🏆 Badge Unlocked: ${b.name}!`);
      newBadge = true;
    }
  });
  if (newBadge) { saveState(); renderRewards(); renderBadges(); }
}

// ─── AI CHAT (/chat) ──────────────────────────────────────────────────────────
async function sendChat() {
  const input = document.getElementById('chatInput');
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;

  input.value = '';
  appendMessage('user', msg);
  state.chatHistory.push({ role: 'user', content: msg });

  const sendBtn = document.getElementById('chatSend');
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<div class="spinner"></div>';
  }

  const total = state.tasks.length;
  const done  = state.tasks.filter(t => t.done).length;
  const context = {
    total_tasks:    total,
    done_tasks:     done,
    completion_pct: total ? Math.round(done / total * 100) : 0,
    xp:             state.xp,
    streak:         state.streak,
    high_pending:   state.tasks.filter(t => !t.done && t.priority === 'high').length,
    next_task:      state.tasks.find(t => !t.done)?.title || 'All done!'
  };

  try {
    const data = await apiPost('/chat', {
      messages: state.chatHistory.slice(-12),
      context
    });

    const reply = (data && data.success && data.reply)
      ? data.reply
      : "⚠️ No response received. Focus on your top task right now.";

    appendMessage('ai', reply);
    state.chatHistory.push({ role: 'assistant', content: reply });

  } catch (e) {
    appendMessage('ai', "⚠️ Could not reach the backend. Make sure Flask is running, then try again.");
  }

  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.innerHTML = 'Send';
  }
}

function appendMessage(role, text) {
  const el = document.getElementById('chatMessages');
  if (!el) return;

  const processed = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.innerHTML = `<div class="msg-bubble">${processed}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function quickAsk(prompt) {
  const input = document.getElementById('chatInput');
  if (input) input.value = prompt;
  sendChat();
}

function clearChat() {
  state.chatHistory = [];
  const el = document.getElementById('chatMessages');
  if (el) el.innerHTML = '';
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
}

// ─── CONTEXT SNAPSHOT ─────────────────────────────────────────────────────────
function updateContextSnap() {
  const el = document.getElementById('contextSnap');
  if (!el) return;
  const total   = state.tasks.length;
  const done    = state.tasks.filter(t => t.done).length;
  const pending = state.tasks.filter(t => !t.done);
  if (!total) { el.textContent = 'No tasks loaded yet. Add tasks in the Planner tab.'; return; }
  el.innerHTML = `
    <div class="mb-8"><strong style="color:var(--text)">Tasks:</strong> ${done}/${total} done (${total ? Math.round(done / total * 100) : 0}%)</div>
    <div class="mb-8"><strong style="color:var(--text)">High priority pending:</strong> ${pending.filter(t => t.priority === 'high').length}</div>
    <div class="mb-8"><strong style="color:var(--text)">XP:</strong> ${state.xp} | Streak: ${state.streak}d</div>
    <div><strong style="color:var(--text)">Next task:</strong> ${pending[0]?.title || 'All done!'}</div>
  `;
}

// ─── CHART ────────────────────────────────────────────────────────────────────
function drawWeekChart() {
  const canvas = document.getElementById('weekChart');
  if (!canvas) return;
  const W = canvas.offsetWidth || 800;
  const H = 100;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const days    = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today   = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;
  const done    = state.tasks.filter(t => t.done).length;

  const data = days.map((_, i) => i === todayIdx ? done : Math.max(0, Math.floor(Math.random() * 6) + (i < todayIdx ? 2 : 0)));
  const max  = Math.max(...data, 1);

  ctx.clearRect(0, 0, W, H);
  const pad = { t: 12, b: 28, l: 8, r: 8 };
  const cw  = (W - pad.l - pad.r) / 7;
  const ch  = H - pad.t - pad.b;

  days.forEach((day, i) => {
    const x     = pad.l + i * cw;
    const barH  = Math.max(4, (data[i] / max) * ch);
    const y     = pad.t + ch - barH;
    const bw    = cw * 0.5;
    const bx    = x + (cw - bw) / 2;
    const isToday = i === todayIdx;

    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, isToday ? '#7c6aff' : '#2dd4bf');
    grad.addColorStop(1, isToday ? '#a78bfa' : '#5eead4');
    ctx.fillStyle = grad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, y, bw, barH, 4);
    else ctx.rect(bx, y, bw, barH);
    ctx.fill();

    ctx.fillStyle = '#5a5a7a';
    ctx.font = '11px Figtree, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(day, x + cw / 2, H - 8);

    if (data[i] > 0) {
      ctx.fillStyle = isToday ? '#a78bfa' : '#5eead4';
      ctx.font = '10px DM Mono, monospace';
      ctx.fillText(data[i], x + cw / 2, y - 3);
    }
  });
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
function showXPPopup(xp, msg) {
  const el = document.createElement('div');
  el.className = 'xp-popup';
  el.textContent = msg || `+${xp} XP`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2700);
}

function showToast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3100);
}

// ─── BOOTSTRAP (single listener) ──────────────────────────────────────────────
window.addEventListener('resize', drawWeekChart);
document.addEventListener('DOMContentLoaded', init);
