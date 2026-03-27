/**
 * AMAN CAR — Main Application (Part 1: Core, Auth, Shell)
 */
import { Database, supabase } from './data.js';
import { WhatsApp } from './whatsapp.js';

/* ── Central State ── */
const State = {
  user: null,
  orders: [],
  services: [],
  profiles: [],
  currentOrderId: null,
  ordersSort: { field: 'createdAt', dir: 'desc' },
  ordersFilter: 'all',
  ordersSearch: '',
  acctFilter: 'all',
  svcSearch: '',
  usersSearch: '',
};

/* ── WhatsApp Helper ── */
async function notifyStatusChange(order, newStatus) {
  if (!order) return;
  try {
    const custPhone = WhatsApp.extractSaudiPhoneNumber(order.customerInfo);
    if (custPhone && ['pending_payment', 'ready_for_delivery'].includes(newStatus)) {
      const msg = WhatsApp.generateCustomerMessage(order, newStatus);
      if (msg) await WhatsApp.sendToWhatsApp(custPhone, msg);
    }
    const adminPhone = WhatsApp.extractSaudiPhoneNumber(WhatsApp.adminPhone || '0500000000');
    if (adminPhone && ['in_progress'].includes(newStatus)) {
      const msg = WhatsApp.generateTechnicianMessage(order, 'assigned');
      if (msg) await WhatsApp.sendToWhatsApp(adminPhone, msg);
    }
  } catch(e) { console.warn('WhatsApp Notification Error:', e); }
}

/* ── Sidebar Collapse Toggle ── */
window.toggleSidebarCollapse = function() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.classList.toggle('collapsed');
  const isCollapsed = sidebar.classList.contains('collapsed');
  localStorage.setItem('sidebarCollapsed', isCollapsed ? '1' : '0');
};

// Restore collapse state on load
(function() {
  if (localStorage.getItem('sidebarCollapsed') === '1') {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.add('collapsed');
  }
})();


/* ── Toast ── */
window.showToast = function(msg, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

/* ── Workspace Loader ── */
function showLoader() { document.getElementById('workspace-loader')?.classList.remove('hidden'); }
function hideLoader() { document.getElementById('workspace-loader')?.classList.add('hidden'); }

/* ── App Boot ── */
async function boot() {
  try {
    State.user = await Database.getCurrentSession();
    document.getElementById('global-loader')?.classList.add('hidden');
    if (State.user) {
      showShell();
    } else {
      document.getElementById('login-screen')?.classList.remove('hidden');
    }
  } catch (e) {
    console.error('Boot error:', e);
    document.getElementById('global-loader')?.classList.add('hidden');
    document.getElementById('login-screen')?.classList.remove('hidden');
  }
  bindLoginForm();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

/* ── Auth Forms ── */
function bindLoginForm() {
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${window.t('LOADING')}`;
    try {
      State.user = await Database.login(email, password);
      document.getElementById('login-screen').classList.add('hidden');
      showShell();
    } catch {
      showToast(window.t('LOGIN_ERROR'), 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-sign-in-alt"></i> ${window.t('LOGIN_btn')}`;
    }
  });

  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${window.t('CREATING')}`;
    try {
      await Database.registerAccount(email, password, name);
      showToast(window.t('REGISTER_SUCCESS'), 'success');
      setTimeout(() => {
        document.getElementById('email').value = email;
        document.getElementById('password').value = password;
        document.getElementById('show-login').click();
        document.getElementById('login-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }, 1500);
    } catch (err) {
      showToast(`${window.t('REGISTER_ERROR')}: ${err.message}`, 'error');
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-user-plus"></i> ${window.t('REGISTER_btn')}`;
    }
  });

  document.getElementById('show-register')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
  });
  document.getElementById('show-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
  });
  document.getElementById('toggle-password')?.addEventListener('click', () => {
    const inp = document.getElementById('password');
    const icon = document.querySelector('#toggle-password i');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    icon.className = inp.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
  });
}

/* ── Dashboard Shell ── */
function showShell() {
  const shell = document.getElementById('dashboard-shell');
  shell?.classList.remove('hidden');
  renderSidebarUser();
  buildNavigation();
  bindShellEvents();
  subscribeToRealtime();
  navigateToDefaultView();
}

function renderSidebarUser() {
  const u = State.user;
  document.getElementById('sidebar-user-name').textContent = u.name || window.t('UNKNOWN');
  document.getElementById('welcome-name').textContent = u.name ? u.name.split(' ')[0] : '';
  const roleLookup = { admin: window.t('ROLE_ADMIN'), technician: window.t('ROLE_TECHNICIAN'), accountant: window.t('ROLE_ACCOUNTANT'), pending: window.t('ROLE_PENDING'), suspended: window.t('ROLE_SUSPENDED') };
  document.getElementById('sidebar-user-role').textContent = roleLookup[u.role] || u.role;
  // Avatar
  if (u.avatarUrl) {
    const avatarEl = document.getElementById('sidebar-avatar');
    if (avatarEl) avatarEl.innerHTML = `<img src="${u.avatarUrl}" alt="avatar">`;
  }
  // Role switcher: only admins
  const rsbtn = document.getElementById('role-switcher-btn');
  if (rsbtn) rsbtn.style.display = u.role === 'admin' ? 'flex' : 'none';
}

function buildNavigation() {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;
  nav.innerHTML = '';
  const role = State.user.role;
  const links = [];

  if (role === 'suspended') {
    links.push({ view: 'view-suspended', icon: 'fa-user-slash', key: 'TITLE_DASHBOARD' });
  } else if (role === 'pending' || !role) {
    links.push({ view: 'view-pending', icon: 'fa-user-clock', key: 'TITLE_DASHBOARD' });
  } else {
    links.push({ view: 'view-dashboard', icon: 'fa-chart-pie', key: 'NAV_DASHBOARD' });
    if (role === 'admin' || role === 'technician') links.push({ view: 'view-work-orders', icon: 'fa-clipboard-list', key: 'NAV_WORK_ORDERS' });
    if (role === 'admin' || role === 'accountant') links.push({ view: 'view-accountant', icon: 'fa-cash-register', key: 'NAV_ACCOUNTANT' });
    if (role === 'admin' || role === 'accountant') links.push({ view: 'view-services', icon: 'fa-tags', key: 'NAV_SERVICES' });
    if (role === 'admin') links.push({ view: 'view-users', icon: 'fa-users-cog', key: 'NAV_USERS' });
  }

  links.forEach(l => {
    const btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.dataset.view = l.view;
    btn.innerHTML = `<i class="fas ${l.icon}"></i><span>${window.t(l.key)}</span>`;
    btn.addEventListener('click', () => switchView(l.view, window.t(l.key)));
    nav.appendChild(btn);
  });
}

function bindShellEvents() {
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await Database.logout();
    location.reload();
  });
  document.getElementById('nav-profile-btn')?.addEventListener('click', () => switchView('view-profile', window.t('NAV_PROFILE')));
  document.getElementById('menu-toggle')?.addEventListener('click', toggleMobileSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', toggleMobileSidebar);
  document.getElementById('toggle-language-btn')?.addEventListener('click', () => {
    window.toggleLanguage();
    renderSidebarUser();
    buildNavigation();
  });

  // Role switcher
  document.getElementById('role-switcher-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('role-dropdown')?.classList.toggle('hidden');
  });
  document.querySelectorAll('[data-switch-role]').forEach(btn => {
    btn.addEventListener('click', () => {
      const fakeRole = btn.dataset.switchRole;
      State.user = { ...State.user, role: fakeRole };
      renderSidebarUser();
      buildNavigation();
      navigateToDefaultView();
      document.getElementById('role-dropdown')?.classList.add('hidden');
    });
  });

  // Notifications
  document.getElementById('notifications-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('notifications-dropdown')?.classList.toggle('hidden');
    renderNotifications();
  });

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#role-switcher-btn') && !e.target.closest('#role-dropdown'))
      document.getElementById('role-dropdown')?.classList.add('hidden');
    if (!e.target.closest('#notifications-btn') && !e.target.closest('#notifications-dropdown'))
      document.getElementById('notifications-dropdown')?.classList.add('hidden');
  });

  // Quick create order button (dashboard)
  document.addEventListener('click', (e) => {
    if (e.target.closest('#quick-create-order-btn')) {
      switchView('view-work-orders', window.t('NAV_WORK_ORDERS'));
      setTimeout(() => openNewOrderForm(), 200);
    }
  });
}

function toggleMobileSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('sidebar-overlay')?.classList.toggle('show');
}

function navigateToDefaultView() {
  const role = State.user.role;
  if (role === 'suspended') return switchView('view-suspended', '');
  if (role === 'pending' || !role) return switchView('view-pending', '');
  if (role === 'technician') return switchView('view-work-orders', window.t('NAV_WORK_ORDERS'));
  if (role === 'accountant') return switchView('view-accountant', window.t('NAV_ACCOUNTANT'));
  switchView('view-dashboard', window.t('NAV_DASHBOARD'));
}

/* ── View Router ── */
window.switchView = function switchView(viewId, title) {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const target = document.getElementById(viewId);
  if (target) target.classList.remove('hidden');

  // Update page title
  if (title) document.getElementById('page-title').textContent = title;

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewId);
  });

  // Initialize view
  const inits = {
    'view-dashboard': initDashboard,
    'view-work-orders': initWorkOrders,
    'view-accountant': initAccountant,
    'view-services': initServices,
    'view-users': initUsers,
    'view-profile': initProfile,
  };
  if (inits[viewId]) inits[viewId]();

  // Close mobile sidebar
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('show');
  }
};

/* ── Realtime ── */
function subscribeToRealtime() {
  if (!State.user?.id) return;
  try {
    supabase.channel('orders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        Database.invalidateOrdersCache();
        const activeView = document.querySelector('.view:not(.hidden)')?.id;
        if (activeView === 'view-dashboard') initDashboard();
        else if (activeView === 'view-work-orders') initWorkOrders();
        else if (activeView === 'view-accountant') initAccountant();
        else if (activeView === 'view-order-details' && State.currentOrderId) openOrderDetails(State.currentOrderId);
      })
      .subscribe();
  } catch (e) { console.warn('Realtime subscription:', e); }
}

/* ── NOTIFICATIONS ── */
function renderNotifications() {
  const list = document.getElementById('notifications-list');
  if (!list) return;
  const now = new Date();
  const alerts = State.orders.filter(o => {
    if (o.status === 'closed' || o.status === 'ready_for_delivery' || !o.deliveryDate) return false;
    return (new Date(o.deliveryDate) - now) <= 86400000;
  });
  if (!alerts.length) { list.innerHTML = `<p class="text-muted text-sm text-center p-3">${window.t('NO_NOTIFICATIONS')}</p>`; return; }
  list.innerHTML = alerts.map(o => {
    const isLate = new Date(o.deliveryDate) < now;
    return `<div class="notif-item" onclick="openOrderDetails('${o.id}')">
      <div class="notif-dot" style="background:${isLate?'var(--danger)':'var(--warning)'}"></div>
      <div><div class="fw-bold text-sm">${o.carPlate} — ${o.carModel}</div>
      <div class="text-xs text-muted">${isLate?window.t('OVERDUE'):window.t('APPROACHING')}: ${new Date(o.deliveryDate).toLocaleDateString('ar-SA')}</div></div>
    </div>`;
  }).join('');
  const badge = document.getElementById('notif-badge');
  if (badge) { badge.textContent = alerts.length; badge.style.display = alerts.length ? 'block' : 'none'; }
}

/* ── DASHBOARD ── */
async function initDashboard() {
  showLoader();
  try {
    State.orders = await Database.getOrders();
    const dateFilter = document.getElementById('dash-date-filter')?.value || 'all';
    const techFilter = document.getElementById('dash-tech-filter')?.value || 'all';
    const now = new Date();
    let orders = State.orders;

    if (State.user.role === 'technician') {
      orders = orders.filter(o => o.createdBy === State.user.name || (o.logs||[]).some(l=>l.status==='in_progress'&&l.by===State.user.name));
    }

    if (dateFilter === 'today') orders = orders.filter(o => new Date(o.createdAt).toDateString() === now.toDateString());
    else if (dateFilter === 'week') { const w = new Date(now); w.setDate(now.getDate()-7); orders = orders.filter(o => new Date(o.createdAt) >= w); }
    else if (dateFilter === 'month') orders = orders.filter(o => { const d=new Date(o.createdAt); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); });
    
    if (State.user.role !== 'technician' && techFilter !== 'all') {
      orders = orders.filter(o => o.createdBy === techFilter || (o.logs||[]).some(l=>l.status==='in_progress'&&l.by===techFilter));
    }

    const inProgress = orders.filter(o => ['in_progress','paid_ready'].includes(o.status)).length;
    const sumPaid = orders.reduce((s,o) => s+o.paidAmount,0);
    const sumTotal = orders.reduce((s,o) => s+o.totalAmount,0);
    el('stat-total').textContent = orders.length;
    el('stat-progress').textContent = inProgress;
    el('stat-revenue').textContent = sumPaid.toLocaleString('ar-SA');
    el('stat-debt').textContent = Math.max(0, sumTotal-sumPaid).toLocaleString('ar-SA');

    renderRecentFeed(orders);
    renderQuickDeliveries(orders, now);
    renderLateDeliveries(orders, now);
    renderMonthlyChart(orders, now);
    renderNotifications();

    // Populate tech filter
    const techSel = document.getElementById('dash-tech-filter');
    if (techSel) {
      if (State.user.role === 'technician') {
        techSel.style.display = 'none';
      } else if (techSel.options.length <= 1) {
        const profiles = await Database.getProfiles();
        profiles.filter(p => ['admin','technician'].includes(p.role)).forEach(p => {
          const opt = new Option(p.full_name, p.full_name); techSel.appendChild(opt);
        });
      }
    }
  } catch(e) { console.error('Dashboard error:', e); }
  finally { hideLoader(); }
}

function renderRecentFeed(orders) {
  const feed = el('recent-feed');
  if (!feed) return;
  const top = orders.slice(0,6);
  if (!top.length) { feed.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>${window.t('NO_ORDERS')}</p></div>`; return; }
  feed.innerHTML = top.map(o => {
    const st = statusMeta(o.status);
    return `<div class="feed-item" onclick="openOrderDetails('${o.id}')">
      <div class="stat-icon primary" style="width:36px;height:36px;font-size:.9rem;flex-shrink:0"><i class="fas fa-car"></i></div>
      <div style="flex:1;min-width:0">
        <div class="fw-bold text-sm truncate">${o.carModel} <span class="badge badge-gray" style="font-size:.65rem;">${o.carPlate}</span></div>
        <div class="text-xs text-muted">#${o.id} &bull; ${new Date(o.createdAt).toLocaleDateString('ar-SA')}</div>
      </div>
      <span class="badge badge-${st.badge}">${st.label}</span>
    </div>`;
  }).join('');
}

function renderQuickDeliveries(orders, now) {
  const feed = el('ready-feed');
  if (!feed) return;
  const ready = orders.filter(o => o.status === 'ready_for_delivery');
  if (!ready.length) { feed.innerHTML = `<div class="text-muted text-sm text-center p-3"><i class="fas fa-check-circle text-success d-block fs-3 mb-2"></i>${window.t('NO_READY_CARS')}</div>`; return; }
  feed.innerHTML = ready.map(o => `<div class="feed-item" onclick="openOrderDetails('${o.id}')">
    <i class="fas fa-car-side text-success"></i>
    <div style="flex:1;min-width:0"><div class="fw-bold text-sm truncate">${o.carPlate}</div><div class="text-xs text-muted truncate">${o.customerInfo}</div></div>
    <span class="text-xs text-primary fw-bold" dir="ltr">#${o.id}</span>
  </div>`).join('');
}

function renderLateDeliveries(orders, now) {
  const feed = el('late-feed');
  if (!feed) return;
  const late = orders.filter(o => {
    if (['closed','ready_for_delivery'].includes(o.status) || !o.deliveryDate) return false;
    return (new Date(o.deliveryDate) - now) <= 86400000;
  }).sort((a,b) => new Date(a.deliveryDate)-new Date(b.deliveryDate));
  if (!late.length) { feed.innerHTML = `<div class="text-muted text-sm text-center p-3"><i class="fas fa-thumbs-up text-secondary d-block fs-3 mb-2"></i>${window.t('NO_LATE_CARS')}</div>`; return; }
  feed.innerHTML = late.map(o => {
    const isLate = new Date(o.deliveryDate) < now;
    return `<div class="feed-item" onclick="openOrderDetails('${o.id}')">
      <i class="fas fa-clock" style="color:${isLate?'var(--danger)':'var(--warning)'}"></i>
      <div style="flex:1;min-width:0">
        <div class="fw-bold text-sm truncate">${o.carPlate}</div>
        <div class="text-xs text-muted">#${o.id}</div>
      </div>
      <span class="badge badge-${isLate?'danger':'warning'}">${window.t(isLate?'OVERDUE':'APPROACHING')}</span>
    </div>`;
  }).join('');
}

function renderMonthlyChart(orders, now) {
  const ctx = document.getElementById('monthly-chart')?.getContext('2d');
  if (!ctx) return;
  const paid = new Array(12).fill(0), total = new Array(12).fill(0);
  orders.forEach(o => {
    const d = new Date(o.createdAt);
    if (d.getFullYear() === now.getFullYear()) { paid[d.getMonth()] += o.paidAmount; total[d.getMonth()] += o.totalAmount; }
  });
  if (window._chart) window._chart.destroy();
  window._chart = new Chart(ctx, {
    type:'bar', data:{ labels: window.t('MONTHS'), datasets:[
      { label: window.t('TOTAL_AMOUNT'), data: total, backgroundColor:'#cbd5e1', borderRadius:4 },
      { label: window.t('FINANCIAL_SUMMARY'), data: paid, backgroundColor:'#2563eb', borderRadius:4 }
    ]}, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ labels:{ font:{ family:'Cairo' }}}}, scales:{ y:{ beginAtZero:true }}}
  });
}

/* ── WORK ORDERS LIST ── */
async function initWorkOrders() {
  showLoader();
  try {
    State.orders = await Database.getOrders();
    state_populateTechFilter('work-orders-tech-filter');
    renderOrdersTable();
  } catch(e) { console.error('WorkOrders error:', e); }
  finally { hideLoader(); }
}

function state_populateTechFilter(selId) {
  const sel = document.getElementById(selId);
  if (!sel || sel.options.length > 1) return;
  const techs = [...new Set(State.orders.map(o => o.createdBy).filter(Boolean))];
  techs.forEach(t => { const opt = new Option(t, t); sel.appendChild(opt); });
}

function getFilteredOrders() {
  const role = State.user.role;
  let orders = State.orders;
  if (role === 'technician') {
    orders = orders.filter(o => o.createdBy === State.user.name || (o.logs||[]).some(l=>l.status==='in_progress'&&l.by===State.user.name));
  }
  const techF = document.getElementById('work-orders-tech-filter')?.value || 'all';
  if (techF !== 'all') orders = orders.filter(o => o.createdBy === techF);

  const hideC = document.getElementById('hide-closed-toggle')?.checked;
  if (hideC) orders = orders.filter(o => o.status !== 'closed');

  if (State.ordersFilter !== 'all') orders = orders.filter(o => o.status === State.ordersFilter);

  const q = State.ordersSearch.toLowerCase();
  if (q) orders = orders.filter(o => (o.carPlate||'').toLowerCase().includes(q)||(o.customerInfo||'').toLowerCase().includes(q)||(o.id||'').toLowerCase().includes(q));

  // Sort
  const { field, dir } = State.ordersSort;
  orders = [...orders].sort((a,b) => {
    let av = a[field], bv = b[field];
    if (typeof av === 'string') av = av.toLowerCase(), bv = bv.toLowerCase();
    if (av < bv) return dir==='asc'?-1:1;
    if (av > bv) return dir==='asc'?1:-1;
    return 0;
  });
  return orders;
}

window.renderOrdersTable = function renderOrdersTable() {
  const orders = getFilteredOrders();
  const tbody = el('orders-tbody');
  if (!tbody) return;
  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-muted"><i class="fas fa-inbox fa-2x mb-2 opacity-25 d-block"></i>${window.t('NO_ORDERS')}</td></tr>`;
    return;
  }
  tbody.innerHTML = orders.map(o => {
    const st = statusMeta(o.status);
    const excess = o.paidAmount - o.totalAmount;
    const remaining = Math.max(0, o.totalAmount - o.paidAmount);
    const pLabel = excess>0?'فائض':(remaining===0?'✓':(o.paidAmount>0?window.t('FILTER_PARTIAL'):window.t('FILTER_UNPAID')));
    const isLate = o.deliveryDate && new Date(o.deliveryDate)<new Date() && !['closed','ready_for_delivery'].includes(o.status);
    const assignedBy = (o.logs||[]).find(l=>l.status==='in_progress')?.by || o.createdBy || '-';
    return `<tr class="clickable" onclick="openOrderDetails('${o.id}')">
      <td class="fw-bold text-primary" dir="ltr" style="text-align: right;">#${o.id}</td>
      <td class="text-sm text-muted">${new Date(o.createdAt).toLocaleDateString('ar-SA')}</td>
      <td class="text-sm ${isLate?'text-danger fw-bold':''}">${o.deliveryDate?new Date(o.deliveryDate).toLocaleDateString('ar-SA'):'-'}</td>
      <td><div class="fw-bold text-sm">${o.carPlate}</div><div class="text-xs text-muted">${o.customerInfo}</div></td>
      <td><span class="badge badge-gray">${assignedBy}</span></td>
      <td class="fw-bold">${(o.totalAmount||0).toLocaleString('ar-SA')} ${window.t('SAR')}</td>
      <td><span class="badge ${excess>0 ? 'badge-primary' : (remaining>0 ? (o.paidAmount>0 ? 'badge-warning' : 'badge-danger') : 'badge-success')}">${(excess>0 ? excess : remaining).toLocaleString('ar-SA')} <small style="opacity:0.8;font-weight:normal">(${pLabel})</small></span></td>
      <td><span class="badge badge-${st.badge}">${st.label}</span></td>
    </tr>`;
  }).join('');
};

window.sortOrders = function(field) {
  State.ordersSort = { field, dir: State.ordersSort.field===field&&State.ordersSort.dir==='asc'?'desc':'asc' };
  renderOrdersTable();
};

/* ── NEW / EDIT ORDER ── */
let selectedServices = {};

window.openNewOrderForm = function() {
  State.currentEditOrderId = null;
  selectedServices = {};
  el('store-order-id').value = '';
  el('store-cust-info').value = '';
  el('store-car-model').value = '';
  el('store-car-plate').value = '';
  el('store-labor').value = '0';
  el('store-discount').value = '0';
  el('store-notes').value = '';
  el('store-internal-note').value = '';
  el('store-attachment-preview').textContent = '';
  switchView('view-new-order', window.t('TITLE_NEW_ORDER'));
  loadServicesForStore();
};

window.openEditOrderForm = function(orderId) {
  const order = State.orders.find(o => o.id === orderId);
  if (!order) return;
  State.currentEditOrderId = orderId;
  selectedServices = {};
  (order.services || []).forEach(s => { selectedServices[s.id] = { ...s }; });
  el('store-order-id').value = orderId;
  el('store-cust-info').value = order.customerInfo || '';
  el('store-car-model').value = order.carModel || '';
  el('store-car-plate').value = order.carPlate || '';
  el('store-labor').value = order.laborCost || 0;
  el('store-discount').value = order.discount || 0;
  el('store-notes').value = order.notes || '';
  switchView('view-new-order', window.t('EDIT_ORDER'));
  loadServicesForStore();
};

async function loadServicesForStore() {
  const list = el('store-services-list');
  if (!list) return;
  list.innerHTML = '<div class="spinner"></div>';
  State.services = await Database.getServices();
  renderServiceCards();
  updateStoreTotals();
}

window.filterStoreServices = function() {
  renderServiceCards();
};

function renderServiceCards() {
  const list = el('store-services-list');
  if (!list) return;
  const q = (el('store-services-search')?.value || '').toLowerCase();
  const filtered = q ? State.services.filter(s => s.name.toLowerCase().includes(q)) : State.services;
  list.innerHTML = filtered.map(s => {
    const sel = selectedServices[s.id];
    const qty = sel ? sel.qty : 0;
    // Use data-* attributes to avoid escaping issues with service names
    return `<div class="service-card ${sel?'selected':''}" id="svc-card-${s.id}"
        data-svc-id="${s.id}" data-svc-price="${s.price}">
      <div class="service-card-top">
        <div class="service-card-icon"><i class="fas ${s.icon||'fa-wrench'}"></i></div>
        <div style="flex:1;min-width:0">
          <div class="service-card-name">${s.name}</div>
          <div class="service-card-price">${s.price} ${window.t('SAR')}</div>
        </div>
      </div>
      <div class="service-card-bottom">
        <div class="text-xs text-muted fw-bold">الكمية المطلوبة</div>
        <div class="service-card-qty">
          <button type="button" class="qty-btn" data-id="${s.id}" data-name="${s.name.replace(/"/g,'&quot;')}" data-price="${s.price}" data-delta="-1">
            <i class="fas fa-minus" style="pointer-events:none"></i>
          </button>
          <span id="qty-${s.id}">${qty}</span>
          <button type="button" class="qty-btn" data-id="${s.id}" data-name="${s.name.replace(/"/g,'&quot;')}" data-price="${s.price}" data-delta="1">
            <i class="fas fa-plus" style="pointer-events:none"></i>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

document.addEventListener('click', function(e) {
  const btn = e.target.closest('.qty-btn');
  if (btn) {
    e.preventDefault();
    e.stopPropagation();
    const id = btn.dataset.id;
    const name = btn.dataset.name || '';
    const price = Number(btn.dataset.price) || 0;
    const delta = Number(btn.dataset.delta) || 0;
    if (!id) return;
    if (!selectedServices[id]) selectedServices[id] = { id, name, price, qty: 0 };
    selectedServices[id].qty = Math.max(0, (selectedServices[id].qty || 0) + delta);
    if (selectedServices[id].qty === 0) delete selectedServices[id];
    
    const qtyEl = document.getElementById(`qty-${id}`);
    if (qtyEl) qtyEl.textContent = selectedServices[id]?.qty ?? 0;
    
    const card = document.getElementById(`svc-card-${id}`);
    if (card) card.classList.toggle('selected', !!selectedServices[id]);
    
    updateStoreTotals();
  }
});

// Delegate inputs for real-time recalculation
document.addEventListener('input', function(e) {
  if (e.target.id === 'store-labor' || e.target.id === 'store-discount') {
    updateStoreTotals();
  }
});

// Keep window.adjustQty for backward compatibility
window.adjustQty = function(id, name, price, delta) {
  if (!selectedServices[id]) selectedServices[id] = { id, name, price, qty: 0 };
  selectedServices[id].qty = Math.max(0, (selectedServices[id].qty || 0) + delta);
  if (selectedServices[id].qty === 0) delete selectedServices[id];
  const qtyEl = el(`qty-${id}`);
  if (qtyEl) qtyEl.textContent = selectedServices[id]?.qty ?? 0;
  const card = el(`svc-card-${id}`);
  if (card) card.classList.toggle('selected', !!selectedServices[id]);
  updateStoreTotals();
};

function updateStoreTotals() {
  const svcTotal = Object.values(selectedServices).reduce((s,x) => s+(x.price*x.qty),0);
  const labor = Number(el('store-labor')?.value) || 0;
  
  const discountInput = el('store-discount');
  let discount = Number(discountInput?.value) || 0;
  
  if (discount > (svcTotal + labor)) {
    discount = svcTotal + labor;
    if (discountInput) discountInput.value = discount;
    showToast('خطأ: قيمة الخصم لا يمكن أن تتجاوز إجمالي الفاتورة', 'error');
  }

  const grand = Math.max(0, svcTotal + labor - discount);
  if(el('store-services-total')) el('store-services-total').textContent = svcTotal.toLocaleString('ar-SA') + ' ' + window.t('SAR');
  if(el('store-labor-total')) el('store-labor-total').textContent = labor.toLocaleString('ar-SA') + ' ' + window.t('SAR');
  if(el('store-discount-total')) el('store-discount-total').textContent = discount.toLocaleString('ar-SA');
  if(el('store-grand-total')) el('store-grand-total').textContent = grand.toLocaleString('ar-SA');
}

/* ── ORDER FORM SUBMIT ── */
function bindOrderForm() {
  const form = document.getElementById('store-order-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const actionStatus = e.submitter?.value || 'pending_payment';
    const svcs = Object.values(selectedServices);
    const labor = Number(el('store-labor')?.value) || 0;
    const discount = Number(el('store-discount')?.value) || 0;
    const svcTotal = svcs.reduce((s,x)=>s+(x.price*x.qty),0);
    
    if (discount > (svcTotal + labor)) {
      showToast('خطأ: قيمة الخصم لا يمكن أن تتجاوز إجمالي الفاتورة', 'error');
      return;
    }

    const total = Math.max(0, svcTotal+labor-discount);
    const orderData = {
      customerInfo: el('store-cust-info').value.trim(),
      carModel: el('store-car-model').value.trim(),
      carPlate: el('store-car-plate').value.trim().toUpperCase(),
      services: svcs,
      totalAmount: total,
      laborCost: labor,
      discount: discount,
      notes: el('store-notes')?.value.trim() || '',
      status: actionStatus,
      createdBy: State.user?.name || 'Unknown',
    };
    if (!orderData.customerInfo || !orderData.carPlate || !orderData.carModel) { showToast('أكمل بيانات العميل والسيارة', 'warning'); return; }
    const btn = e.submitter; const orig = btn?.innerHTML;
    if (btn) { btn.disabled=true; btn.innerHTML=`<i class="fas fa-spinner fa-spin"></i>`; }
    try {
      // Handle internal note
      const noteText = el('store-internal-note')?.value.trim();
      const attachFile = el('store-internal-attachment')?.files?.[0];
      const editId = el('store-order-id')?.value;
      let saved;
      if (editId) {
        saved = await Database.updateOrder(editId, orderData);
      } else {
        saved = await Database.addOrder(orderData);
      }
      if (saved && noteText) {
        let attUrl = null, attName = null;
        if (attachFile) { const r = await Database.uploadNoteAttachment(saved.id, attachFile); attUrl=r.url; attName=r.name; }
        await Database.addOrderNote(saved.id, noteText, State.user?.name || 'Unknown', attUrl, attName);
      }
      showToast(window.t('SUCCESS'), 'success');
      Database.invalidateOrdersCache();
      if (saved) notifyStatusChange(saved, actionStatus);
      switchView('view-work-orders', window.t('NAV_WORK_ORDERS'));
    } catch(err) { showToast(err.message, 'error'); }
    if (btn) { btn.disabled=false; btn.innerHTML=orig; }
  });
}
// Execute immediately since we are a deferred module
bindOrderForm();

/* ── ORDER DETAILS ── */
window.openOrderDetails = function(orderId) {
  const order = State.orders.find(o => o.id === orderId);
  if (!order) { showToast('Order not found', 'error'); return; }
  State.currentOrderId = orderId;
  switchView('view-order-details', `${window.t('TITLE_ORDER_DETAILS')} #${orderId}`);
  renderOrderDetails(order);
};

function renderOrderDetails(order) {
  const st = statusMeta(order.status);
  el('detail-order-id').textContent = `#${order.id}`;
  el('detail-order-meta').textContent = `${window.t('CREATED_DATE')}: ${new Date(order.createdAt).toLocaleString('ar-SA')}`;
  el('detail-status-badge').innerHTML = `<span class="badge badge-${st.badge} text-lg">${st.label}</span>`;
  el('detail-cust-name').textContent = order.customerInfo || '-';
  el('detail-car-model').textContent = order.carModel || '-';
  el('detail-car-plate').textContent = order.carPlate || '-';
  const assignedTech = (order.logs||[]).find(l=>l.status==='in_progress')?.by || order.createdBy || '-';
  el('detail-created-by').textContent = assignedTech;

  // Delivery date
  const delivLabel = el('detail-delivery-date');
  if (delivLabel) delivLabel.textContent = order.deliveryDate ? new Date(order.deliveryDate).toLocaleString('ar-SA') : '-';

  // Services list
  const svcs = order.services || [];
  el('detail-services-list').innerHTML = svcs.length
    ? svcs.map(s => `<li class="py-1 border-bottom"><span class="fw-bold">${s.name}</span> &times; ${s.qty || 1} = <span class="text-primary fw-bold">${((s.price||0)*(s.qty||1)).toLocaleString('ar-SA')} ${window.t('SAR')}</span></li>`).join('')
    : `<li class="text-muted">${window.t('NO_SERVICES')}</li>`;

  // Notes box
  const notesBox = el('detail-notes-box');
  if (notesBox) { notesBox.style.display = order.notes ? 'block' : 'none'; el('detail-notes-content').textContent = order.notes || ''; }

  // Financials
  const svcTotal = svcs.reduce((s,x)=>s+(x.price||0)*(x.qty||1),0);
  el('detail-svc-total').textContent = `${svcTotal.toLocaleString('ar-SA')} ${window.t('SAR')}`;
  el('detail-labor').textContent = `${(order.laborCost||0).toLocaleString('ar-SA')} ${window.t('SAR')}`;
  el('detail-discount').textContent = `${(order.discount||0).toLocaleString('ar-SA')} ${window.t('SAR')}`;
  el('detail-grand-total').textContent = `${(order.totalAmount||0).toLocaleString('ar-SA')} ${window.t('SAR')}`;

  renderActionButtons(order);
  renderNotesAndAuditLog(order);

  // Reassign technician (admin only)
  const reassignWrap = el('reassign-wrap');
  if (reassignWrap) {
    if (State.user.role === 'admin' && !['closed'].includes(order.status)) {
      reassignWrap.classList.remove('hidden');
      const sel = el('reassign-tech-sel');
      if (sel) {
        sel.innerHTML = '';
        Database.getProfiles().then(profiles => {
          profiles.filter(p=>['technician','admin'].includes(p.role)).forEach(p=>{
            const opt=new Option(p.full_name, p.full_name);
            opt.selected = p.full_name === assignedTech;
            sel.appendChild(opt);
          });
        });
      }
    } else { reassignWrap.classList.add('hidden'); }
  }
}

function renderActionButtons(order) {
  const container = el('detail-actions');
  if (!container) return;
  const role = State.user.role;
  const btns = [];

  if (role === 'admin' || role === 'accountant') {
    if (order.status === 'pending_payment' || order.status === 'partially_paid') {
      btns.push(`<button class="btn btn-success" onclick="approvePaymentAction('${order.id}')">${window.t('BTN_APPROVE_PAYMENT')}</button>`);
    }
    if (['pending_payment','partially_paid','paid_ready','in_progress','ready_for_delivery', 'closed'].includes(order.status)) {
      const excess = order.paidAmount - order.totalAmount;
      const remaining = Math.max(0, order.totalAmount - order.paidAmount);
      if (excess > 0) {
        btns.push(`<button class="btn" style="background-color: #9c27b0; color: white;" onclick="openRefundModal('${order.id}', ${excess})"><i class="fas fa-undo me-1"></i> رد الفائض (${excess.toLocaleString('ar-SA')} ${window.t('SAR')})</button>`);
      } else if (remaining > 0 && order.status !== 'closed') {
        // Redesigned: Clear UX with Full Payment vs Partial Payment
        btns.push(`<button class="btn btn-outline-success" onclick="openPaymentModal('${order.id}', ${remaining}, 'full')"><i class="fas fa-check-double me-1"></i> سداد كامل (${remaining.toLocaleString('ar-SA')} ${window.t('SAR')})</button>`);
        btns.push(`<button class="btn btn-outline-primary" onclick="openPaymentModal('${order.id}', ${remaining}, 'partial')"><i class="fas fa-hand-holding-usd me-1"></i> سداد جزئي</button>`);
      }
    }
    if (order.status === 'ready_for_delivery') {
      const remainingForDelivery = order.totalAmount - order.paidAmount;
      if (remainingForDelivery > 0) {
        btns.push(`<button class="btn btn-danger" disabled style="opacity:0.9; cursor:not-allowed;">
          <i class="fas fa-lock me-1"></i> لا يمكن التسليم (متبقي ${remainingForDelivery.toLocaleString('ar-SA')} ${window.t('SAR')})
        </button>`);
      } else {
        btns.push(`<button class="btn btn-primary" onclick="closeOrderAction('${order.id}')">
          <i class="fas fa-check-double me-1"></i> ${window.t('BTN_CLOSE_ORDER')}
        </button>`);
      }
    }
  }
  if (role === 'admin' || role === 'technician') {
    if (order.status === 'paid_ready') {
      btns.push(`<button class="btn btn-warning" onclick="openDeliveryModal('${order.id}')">${window.t('BTN_START_WORK')}</button>`);
    }
    if (order.status === 'in_progress') {
      btns.push(`<button class="btn btn-success" onclick="markReadyAction('${order.id}')">${window.t('BTN_MARK_READY')}</button>`);
    }
  }
  if (role === 'admin') {
    if (!['closed'].includes(order.status)) {
      btns.push(`<button class="btn btn-light" onclick="openEditOrderForm('${order.id}')">${window.t('EDIT_ORDER')}</button>`);
    }
  }
  container.innerHTML = btns.join('') || `<p class="text-muted text-sm">${window.t('NO_URGENT_ALERTS')}</p>`;
}

function renderNotesAndAuditLog(order) {
  const notesList = el('detail-notes-list');
  const histList = el('detail-history-list');
  const logs = order.logs || [];

  const notes = logs.filter(l => l.status === 'internal_note');
  if (notesList) {
    notesList.innerHTML = notes.length
      ? notes.map(n => {
          const initials = (n.by||'?').charAt(0).toUpperCase();
          return `<div class="note-item">
            <div class="note-avatar">${initials}</div>
            <div class="note-bubble">
              <div class="note-meta"><strong>${n.by||'?'}</strong> &mdash; ${new Date(n.timestamp).toLocaleString('ar-SA')}</div>
              <div class="note-text">${n.text||''}</div>
              ${n.attachmentUrl?`<a href="${n.attachmentUrl}" target="_blank" class="note-attachment"><i class="fas fa-paperclip"></i>${n.attachmentName||'مرفق'}</a>`:''}
            </div>
          </div>`;
        }).join('')
      : `<p class="text-muted text-sm text-center">${window.t('NO_NOTES')}</p>`;
  }

  const hist = logs.filter(l => l.status !== 'internal_note');
  if (histList) {
    const statusIcons = { pending_payment:'fa-money-bill', paid_ready:'fa-check', in_progress:'fa-tools', ready_for_delivery:'fa-check-double', closed:'fa-lock', technician_reassigned:'fa-exchange-alt', draft:'fa-file' };
    histList.innerHTML = hist.length
      ? [...hist].reverse().map(h => {
          const st = statusMeta(h.status);
          return `<div class="d-flex align-items-start gap-2 py-2 border-bottom">
            <span class="badge badge-${st.badge} flex-shrink-0" style="margin-top:.2rem"><i class="fas ${statusIcons[h.status]||'fa-circle'}" style="font-size:.6rem"></i></span>
            <div><div class="text-sm fw-bold">${st.label}</div><div class="text-xs text-muted">${h.by||''} &mdash; ${new Date(h.timestamp).toLocaleString('ar-SA')}</div>${h.note?`<div class="text-xs text-secondary">${h.note}</div>`:''}</div>
          </div>`;
        }).join('')
      : `<p class="text-muted text-sm text-center">${window.t('NO_HISTORY')}</p>`;
  }
}

/* ── ORDER ACTION handlers ── */
window.approvePaymentAction = async function(orderId) {
  const order = State.orders.find(o => o.id === orderId);
  if (order && order.totalAmount > 0 && order.paidAmount === 0) {
    showToast('لا يمكن اعتماد الاستلام وبدء العمل قبل سداد دفعة مقدمة على الأقل', 'error');
    return;
  }
  if (!confirm(window.t('CONFIRM_ACTION'))) return;
  try {
    showLoader();
    await Database.updateOrderStatus(orderId, 'paid_ready', State.user.name);
    Database.invalidateOrdersCache();
    State.orders = await Database.getOrders();
    State.currentOrderId = orderId;
    renderOrderDetails(State.orders.find(o=>o.id===orderId));
    showToast(window.t('SUCCESS'), 'success');
  } catch(e) { showToast(e.message,'error'); } finally { hideLoader(); }
};

window.markReadyAction = async function(orderId) {
  if (!confirm(window.t('CONFIRM_ACTION'))) return;
  try {
    showLoader();
    await Database.updateOrderStatus(orderId, 'ready_for_delivery', State.user.name);
    Database.invalidateOrdersCache();
    State.orders = await Database.getOrders();
    const updatedOrder = State.orders.find(o=>o.id===orderId);
    if (updatedOrder) notifyStatusChange(updatedOrder, 'ready_for_delivery');
    renderOrderDetails(updatedOrder);
    showToast(window.t('SUCCESS'), 'success');
  } catch(e) { showToast(e.message,'error'); } finally { hideLoader(); }
};

window.closeOrderAction = async function(orderId) {
  const order = State.orders.find(o => o.id === orderId);
  if (order && (order.totalAmount - order.paidAmount > 0)) {
    showToast('لا يمكن تسليم السيارة، يوجد مبلغ متبقي غير مسدد', 'error');
    return;
  }
  if (!confirm(window.t('CONFIRM_CLOSE_ORDER'))) return;
  try {
    showLoader();
    await Database.updateOrderStatus(orderId, 'closed', State.user.name);
    Database.invalidateOrdersCache();
    State.orders = await Database.getOrders();
    renderOrderDetails(State.orders.find(o=>o.id===orderId));
    showToast(window.t('SUCCESS'), 'success');
  } catch(e) { showToast(e.message,'error'); } finally { hideLoader(); }
};

window.addOrderNoteAction = async function() {
  const noteEl = el('new-internal-note');
  if (!noteEl) return;
  const text = noteEl.value.trim();
  if (!text) { showToast('أكتب ملاحظة أولاً', 'warning'); return; }
  const attachFile = el('new-note-attachment')?.files?.[0];
  const btn = el('btn-add-note');
  if (btn) { btn.disabled=true; btn.innerHTML=`<i class="fas fa-spinner fa-spin"></i>`; }
  try {
    let attUrl=null,attName=null;
    if (attachFile) { const r=await Database.uploadNoteAttachment(State.currentOrderId,attachFile); attUrl=r.url; attName=r.name; }
    await Database.addOrderNote(State.currentOrderId, text, State.user?.name || 'Unknown', attUrl, attName);
    noteEl.value='';
    if(el('attachment-preview-name')) el('attachment-preview-name').textContent='';
    Database.invalidateOrdersCache();
    State.orders = await Database.getOrders();
    const order = State.orders.find(o=>o.id===State.currentOrderId);
    if(order) renderNotesAndAuditLog(order);
    showToast(window.t('SUCCESS'), 'success');
  } catch(e) { console.error('Note error:', e); showToast(e.message,'error'); }
  if (btn) { btn.disabled=false; btn.innerHTML=`<i class="fas fa-paper-plane me-2"></i>إرسال وحفظ`; }
};

window.reassignTechnicianAction = async function() {
  const sel = el('reassign-tech-sel');
  if (!sel || !State.currentOrderId) return;
  const newTech = sel.value;
  if (!newTech) return;
  try {
    showLoader();
    await Database.reassignTechnician(State.currentOrderId, newTech, State.user.name);
    Database.invalidateOrdersCache();
    State.orders = await Database.getOrders();
    renderOrderDetails(State.orders.find(o=>o.id===State.currentOrderId));
    showToast(window.t('SUCCESS'), 'success');
  } catch(e) { showToast(e.message,'error'); } finally { hideLoader(); }
};

/* ── Delivery Date Modal ── */
window.openDeliveryModal = function(orderId) {
  el('delivery-order-id').value = orderId;
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  const localIsoNow = new Date(now.getTime() - tzOffset).toISOString().slice(0,16);
  el('delivery-date-input').min = localIsoNow;

  const def = new Date(); def.setDate(def.getDate()+1); def.setHours(17,0,0,0);
  el('delivery-date-input').value = new Date(def.getTime() - tzOffset).toISOString().slice(0,16);
  el('delivery-modal').classList.remove('hidden');
};
window.closeDeliveryModal = function() { el('delivery-modal').classList.add('hidden'); };
window.confirmDeliveryDate = async function() {
  const orderId = el('delivery-order-id').value;
  const order = State.orders.find(o => o.id === orderId);
  if (order && order.totalAmount > 0 && order.paidAmount === 0) {
    showToast('لا يمكن بدء العمل قبل سداد دفعة مقدمة على الأقل', 'error');
    closeDeliveryModal();
    return;
  }
  const dateVal = el('delivery-date-input').value;
  const selectedDate = dateVal ? new Date(dateVal) : new Date();
  
  if (selectedDate < new Date()) {
    showToast('لا يمكن اختيار موعد في الماضي', 'error');
    return;
  }

  const deliveryDate = selectedDate.toISOString();
  try {
    showLoader();
    await Database.updateOrderStatus(orderId, 'in_progress', State.user.name, deliveryDate);
    Database.invalidateOrdersCache();
    State.orders = await Database.getOrders();
    closeDeliveryModal();
    const updatedOrder = State.orders.find(o=>o.id===orderId);
    if (updatedOrder) notifyStatusChange(updatedOrder, 'in_progress');
    renderOrderDetails(updatedOrder);
    showToast(window.t('SUCCESS'), 'success');
  } catch(e) { showToast(e.message,'error'); } finally { hideLoader(); }
};

/* ── Payment Modal ── */
window.openPaymentModal = function(orderId, remaining, type = 'partial') {
  const typeInput = el('payment-type-input');
  if (typeInput) typeInput.value = '';
  el('payment-order-id').value = orderId;
  el('payment-remaining').textContent = `${remaining.toLocaleString('ar-SA')} ${window.t('SAR')}`;
  
  const amtInput = el('payment-amount-input');
  amtInput.value = remaining;
  
  // UX logic for Full vs Partial
  if (type === 'full') {
    amtInput.readOnly = true;
    amtInput.parentElement.style.opacity = '0.7'; 
    el('payment-modal-title').textContent = 'سداد المبلغ كامل';
  } else {
    amtInput.readOnly = false;
    amtInput.parentElement.style.opacity = '1';
    amtInput.value = ''; // let user decide how much to pay partially
    el('payment-modal-title').textContent = 'سداد دفعة جزئية';
  }
  
  el('payment-modal').classList.remove('hidden');
};
window.closePaymentModal = function() { el('payment-modal').classList.add('hidden'); };

window.confirmPayment = async function() {
  const orderId = el('payment-order-id').value;
  const amount = Number(el('payment-amount-input').value);
  const typeInput = el('payment-type-input');
  const isRefund = typeInput && typeInput.value === 'refund';
  
  if (!amount || amount <= 0) { showToast('أدخل مبلغاً صحيحاً', 'warning'); return; }
  try {
    showLoader();
    await Database.processPayment(orderId, isRefund ? -amount : amount);
    if (typeInput) typeInput.value = '';
    Database.invalidateOrdersCache();
    State.orders = await Database.getOrders();
    closePaymentModal();
    renderOrderDetails(State.orders.find(o=>o.id===orderId));
    showToast(isRefund ? 'تم رد الفائض بنجاح' : window.t('SUCCESS'), 'success');
  } catch(e) { showToast(e.message,'error'); } finally { hideLoader(); }
};

/* ── Refund Modal ── */
window.openRefundModal = function(orderId, excess) {
  el('payment-order-id').value = orderId;
  el('payment-remaining').textContent = `${excess.toLocaleString('ar-SA')} ${window.t('SAR')} (فائض)`;
  
  const amtInput = el('payment-amount-input');
  amtInput.value = excess;
  amtInput.readOnly = true;
  amtInput.parentElement.style.opacity = '0.7'; 
  el('payment-modal-title').textContent = 'تأكيد رد الفائض للعميل';
  
  let typeInput = el('payment-type-input');
  if (!typeInput) {
    typeInput = document.createElement('input');
    typeInput.type = 'hidden';
    typeInput.id = 'payment-type-input';
    el('payment-amount-input').parentNode.appendChild(typeInput);
  }
  typeInput.value = 'refund';
  
  el('payment-modal').classList.remove('hidden');
};

/* ── ACCOUNTANT VIEW ── */
async function initAccountant() {
  showLoader();
  try {
    State.orders = await Database.getOrders();
    renderAccountantGrid();
  } catch(e) { console.error(e); }
  finally { hideLoader(); }
}

window.renderAccountantGrid = function() {
  const q = (el('search-accountant')?.value||'').toLowerCase();
  const filter = State.acctFilter;
  let orders = State.orders.filter(o => ['pending_payment','partially_paid','paid_ready','in_progress','ready_for_delivery','closed'].includes(o.status));
  if (filter === 'unpaid') orders = orders.filter(o => o.paidAmount === 0);
  else if (filter === 'partially_paid') orders = orders.filter(o => o.paidAmount > 0 && o.paidAmount < o.totalAmount);
  else if (filter === 'paid') orders = orders.filter(o => o.paidAmount >= o.totalAmount);
  if (q) orders = orders.filter(o => (o.id||'').toLowerCase().includes(q)||(o.carPlate||'').toLowerCase().includes(q)||(o.customerInfo||'').toLowerCase().includes(q));
  const tbody = el('acct-tbody');
  if (!tbody) return;
  if (!orders.length) { tbody.innerHTML=`<tr><td colspan="6" class="text-center p-4 text-muted">${window.t('NO_ORDERS')}</td></tr>`; return; }
  tbody.innerHTML = orders.map(o => {
    const excess = o.paidAmount - o.totalAmount;
    const remaining = Math.max(0, o.totalAmount - o.paidAmount);
    const pStatus = excess>0?'excess':(remaining===0?'paid':(o.paidAmount>0?'partially_paid':'unpaid'));
    const badgeMap = { paid:'success', partially_paid:'warning', unpaid:'danger', excess:'info' };
    const labelMap = { paid: window.t('FILTER_PAID'), partially_paid: window.t('FILTER_PARTIAL'), unpaid: window.t('FILTER_UNPAID'), excess: 'فائض مبلغ' };
    const st = statusMeta(o.status);
    return `<tr class="clickable" onclick="openOrderDetails('${o.id}')">
      <td class="fw-bold text-primary" dir="ltr" style="text-align: right;">${o.id}</td>
      <td class="text-sm">${new Date(o.createdAt).toLocaleDateString('ar-SA')}</td>
      <td><div class="fw-bold text-sm">${o.carPlate}</div><div class="text-xs text-muted">${o.customerInfo}</div></td>
      <td class="fw-bold">${(o.totalAmount||0).toLocaleString('ar-SA')} ${window.t('SAR')}</td>
      <td><span class="badge ${excess>0 ? 'badge-primary' : (remaining>0 ? (o.paidAmount>0 ? 'badge-warning' : 'badge-danger') : 'badge-success')}">${(excess>0 ? excess : remaining).toLocaleString('ar-SA')} ${window.t('SAR')}</span></td>
      <td><span class="badge badge-${badgeMap[pStatus]}">${labelMap[pStatus]}</span></td>
    </tr>`;
  }).join('');
};

/* ── SERVICES VIEW ── */
let svcFormBound = false;
async function initServices() {
  showLoader();
  try {
    State.services = await Database.getServices();
    loadServicesTable();
    if (!svcFormBound) {
      document.getElementById('service-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = el('srv-id').value;
        const name = el('srv-name').value.trim();
        const price = Number(el('srv-price').value);
        const icon = el('srv-icon').value.trim() || 'fa-wrench';
        if (!name || !price) return;
        const btn = e.target.querySelector('button[type="submit"]');
        const orig = btn.innerHTML; btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>';
        try {
          if (id) await Database.updateService(id, name, price, icon);
          else await Database.addService(name, price, icon);
          showToast(window.t('SERVICE_SAVED'), 'success');
          closeServicePanel();
          State.services = await Database.getServices();
          loadServicesTable();
        } catch(err) { showToast(err.message,'error'); }
        btn.disabled=false; btn.innerHTML=orig;
      });
      svcFormBound = true;
    }
  } catch(e) { console.error(e); }
  finally { hideLoader(); }
}

window.loadServicesTable = function() {
  const tbody = el('services-tbody');
  if (!tbody) return;
  const q = (el('search-services')?.value||'').toLowerCase();
  let svcs = State.services;
  if (q) svcs = svcs.filter(s => s.name.toLowerCase().includes(q));
  if (!svcs.length) { tbody.innerHTML=`<tr><td colspan="4" class="text-center p-4 text-muted">${window.t('NO_SERVICES')}</td></tr>`; return; }
  tbody.innerHTML = svcs.map(s => `<tr>
    <td><i class="fas ${s.icon||'fa-wrench'} text-primary me-2"></i><strong>${s.name}</strong></td>
    <td class="fw-bold">${s.price} ${window.t('SAR')}</td>
    <td class="text-sm text-muted">${new Date(s.created_at).toLocaleDateString('ar-SA')}</td>
    <td>
      <button class="btn btn-sm btn-outline-primary" onclick="openServicePanel('${s.id}','${s.name.replace(/'/g,"\\'")}',${s.price},'${s.icon||'fa-wrench'}')"><i class="fas fa-edit"></i></button>
      <button class="btn btn-sm btn-outline-danger ms-1" onclick="deleteServiceAction('${s.id}')"><i class="fas fa-eye-slash"></i></button>
    </td>
  </tr>`).join('');
};

window.openServicePanel = function(id='',name='',price='',icon='fa-wrench') {
  el('srv-id').value=id; el('srv-name').value=name; el('srv-price').value=price; el('srv-icon').value=icon;
  el('service-panel').classList.remove('hidden');
};
window.closeServicePanel = function() {
  el('service-panel').classList.add('hidden');
  document.getElementById('service-form')?.reset();
};
window.deleteServiceAction = async function(id) {
  if (!confirm(window.t('CONFIRM_ARCHIVE'))) return;
  try {
    await Database.deleteService(id);
    State.services = await Database.getServices();
    loadServicesTable();
    showToast(window.t('SUCCESS'), 'success');
  } catch(e) { showToast(e.message,'error'); }
};

/* ── USERS VIEW ── */
async function initUsers() {
  showLoader();
  try {
    State.profiles = await Database.getProfiles();
    renderUsersList();
    const form = document.getElementById('new-user-form');
    if (form) {
      const fresh = form.cloneNode(true);
      form.parentNode.replaceChild(fresh, form);
      fresh.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = el('new-user-name').value.trim();
        const email = el('new-user-email').value.trim();
        const pass = el('new-user-pass').value.trim();
        const role = el('new-user-role').value;
        const btn = e.target.querySelector('button[type="submit"]');
        const orig=btn.innerHTML; btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>';
        try {
          await Database.createUserAccount(email, pass, name, role);
          showToast(window.t('USER_CREATED'), 'success');
          fresh.reset();
          State.profiles = await Database.getProfiles();
          renderUsersList();
        } catch(err) { showToast(err.message,'error'); }
        btn.disabled=false; btn.innerHTML=orig;
      });
    }
  } catch(e) { console.error(e); }
  finally { hideLoader(); }
}

window.renderUsersList = function() {
  const tbody = el('users-tbody');
  if (!tbody) return;
  const q = (el('search-users')?.value||'').toLowerCase();
  let profiles = State.profiles;
  if (q) profiles = profiles.filter(p => (p.full_name||'').toLowerCase().includes(q)||(p.email||'').toLowerCase().includes(q));
  const roleMap = { admin:window.t('ROLE_ADMIN'), technician:window.t('ROLE_TECHNICIAN'), accountant:window.t('ROLE_ACCOUNTANT'), pending:window.t('ROLE_PENDING'), suspended:window.t('ROLE_SUSPENDED') };
  const badgeMap = { admin:'primary', technician:'warning', accountant:'info', pending:'gray', suspended:'danger' };
  tbody.innerHTML = profiles.map(p => `<tr>
    <td><div class="fw-bold text-sm">${p.full_name||'-'}</div><div class="text-xs text-muted">${p.email||'-'}</div></td>
    <td><span class="badge badge-${badgeMap[p.role]||'gray'}">${roleMap[p.role]||p.role}</span></td>
    <td class="text-sm text-muted">${new Date(p.created_at).toLocaleDateString('ar-SA')}</td>
    <td>
      <select class="form-input" style="width:auto;padding:.3rem .5rem;font-size:.75rem" onchange="changeUserRoleAction('${p.id}',this.value)">
        ${['pending','technician','accountant','admin','suspended'].map(r=>`<option value="${r}"${p.role===r?' selected':''}>${roleMap[r]}</option>`).join('')}
      </select>
    </td>
  </tr>`).join('') || `<tr><td colspan="4" class="text-center p-4 text-muted">لا يوجد موظفين.</td></tr>`;
};

window.changeUserRoleAction = async function(userId, newRole) {
  try {
    await Database.updateUserRole(userId, newRole);
    State.profiles = await Database.getProfiles();
    renderUsersList();
    showToast(window.t('SUCCESS'), 'success');
  } catch(e) { showToast(e.message,'error'); }
};

/* ── PROFILE VIEW ── */
function initProfile() {
  const u = State.user;
  el('profile-name-display').textContent = u.name||'';
  const roleMap = { admin:window.t('ROLE_ADMIN'), technician:window.t('ROLE_TECHNICIAN'), accountant:window.t('ROLE_ACCOUNTANT'), pending:window.t('ROLE_PENDING'), suspended:window.t('ROLE_SUSPENDED') };
  el('profile-role-display').textContent = roleMap[u.role]||u.role;
  const nameInp = el('profile-fullname'); if(nameInp) nameInp.value = u.name||'';
  const passInp = el('profile-password'); if(passInp) passInp.value = '';
  const preview = el('profile-avatar-preview');
  const icon = el('profile-avatar-icon');
  if (u.avatarUrl && preview) { preview.src=u.avatarUrl; preview.style.display='block'; if(icon) icon.style.display='none'; }
  let b64Temp = null;
  const fileInp = el('avatar-upload');
  if (fileInp) fileInp.onchange = (e) => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 256; let {width,height} = img;
        if(width>height){if(width>max){height*=max/width;width=max;}}else{if(height>max){width*=max/height;height=max;}}
        canvas.width=width; canvas.height=height;
        canvas.getContext('2d').drawImage(img,0,0,width,height);
        b64Temp = canvas.toDataURL('image/jpeg',.8);
        if(preview){preview.src=b64Temp;preview.style.display='block';if(icon)icon.style.display='none';}
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  const saveBtn = el('save-profile-btn');
  if (saveBtn) saveBtn.onclick = async () => {
    const newName = (el('profile-fullname')?.value||'').trim();
    const newPass = el('profile-password')?.value||'';
    if (!newName) { showToast(window.t('ERROR'),'warning'); return; }
    saveBtn.disabled=true; saveBtn.innerHTML=`<i class="fas fa-spinner fa-spin"></i> ${window.t('SAVING')}`;
    try {
      await Database.updateProfileSettings(u.id, newName!==u.name?newName:null, newPass||null);
      if (b64Temp) await Database.updateProfileAvatar(u.id, b64Temp);
      showToast(window.t('PROFILE_SAVED'),'success');
      setTimeout(()=>location.reload(), 1500);
    } catch(err) { showToast(err.message,'error'); }
    saveBtn.disabled=false; saveBtn.innerHTML=`<i class="fas fa-save me-2"></i>${window.t('SAVE_CHANGES')}`;
  };
}

/* ── HELPERS ── */
function el(id) { return document.getElementById(id); }

function statusMeta(status) {
  const map = {
    draft:             { label: window.t('STATUS_DRAFT'), badge: 'gray' },
    pending_payment:   { label: window.t('STATUS_PENDING_PAYMENT'), badge: 'danger' },
    partially_paid:    { label: window.t('STATUS_PARTIALLY_PAID'), badge: 'warning' },
    paid_ready:        { label: window.t('STATUS_PAID_READY'), badge: 'primary' },
    in_progress:       { label: window.t('STATUS_IN_PROGRESS'), badge: 'info' },
    ready_for_delivery:{ label: window.t('STATUS_READY'), badge: 'success-light' },
    closed:            { label: window.t('STATUS_CLOSED'), badge: 'success' },
    technician_reassigned: { label: window.t('REASSIGN_TECH'), badge: 'info' },
    internal_note:     { label: window.t('INTERNAL_NOTES_TITLE'), badge: 'primary' },
  };
  return map[status] || { label: status, badge: 'gray' };
}

/* Expose for html inline handlers */
window.initDashboard = initDashboard;
window.initWorkOrders = initWorkOrders;
window.initAccountant = initAccountant;

window.Database = Database;
window.State = State;
