/**
 * AMAN CAR — Data Layer
 * Clean Supabase integration with proper caching and error handling.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isDemoMode = !SUPABASE_URL || !SUPABASE_KEY;

function _buildMockClient() {
  const noop = async () => ({});
  const mockAuth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithPassword: noop,
    signUp: noop,
    signOut: async () => {},
    updateUser: noop,
  };
  const mockChain = () => ({ data: null, error: null, select: mockChain, eq: mockChain, neq: mockChain, order: mockChain, single: noop, maybeSingle: noop, insert: mockChain, update: mockChain });
  return {
    auth: mockAuth,
    from: () => mockChain(),
    storage: { from: () => ({ upload: noop, getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
    channel: () => ({ on: () => ({ subscribe: () => {} }) }),
  };
}

export const supabase = isDemoMode ? _buildMockClient() : createClient(SUPABASE_URL, SUPABASE_KEY);

/* ── Mock Data ── */
const MOCK_SERVICES = [
  { id: 'm1', name: 'غيار زيت وفلتر', price: 150, icon: 'fa-oil-can', created_at: new Date().toISOString() },
  { id: 'm2', name: 'فحص كمبيوتر شامل', price: 100, icon: 'fa-laptop-code', created_at: new Date().toISOString() },
  { id: 'm3', name: 'تغيير فحمات (طقم أقمشة)', price: 80, icon: 'fa-tools', created_at: new Date().toISOString() },
  { id: 'm4', name: 'غسيل داخلي وخارجي', price: 50, icon: 'fa-shower', created_at: new Date().toISOString() },
  { id: 'm5', name: 'تبديل بطارية', price: 200, icon: 'fa-car-battery', created_at: new Date().toISOString() },
  { id: 'm6', name: 'كشف توالي وبالنس', price: 60, icon: 'fa-circle-notch', created_at: new Date().toISOString() },
];

const _buildMockOrders = () => {
  const s1 = JSON.stringify([{ id: 'm1', name: 'غيار زيت وفلتر', price: 150, qty: 1 }]);
  const s2 = JSON.stringify([{ id: 'm2', name: 'فحص كمبيوتر شامل', price: 100, qty: 1 }, { id: 'm3', name: 'تغيير فحمات', price: 80, qty: 1 }]);
  return [
    _mapOrder({ id: 'WO-1001', customer_info: 'ياسر 0501111111', car_plate: 'ABC 123', car_model: 'كامري 2021', services: s1, total_amount: 150, labor_cost: 0, discount: 0, paid_amount: 0, status: 'draft', notes: '', created_at: new Date().toISOString(), created_by: 'المدير العام', delivery_date: null, logs: '[]' }),
    _mapOrder({ id: 'WO-1002', customer_info: 'سعد 0502222222', car_plate: 'XYZ 999', car_model: 'فورد تورس', services: s2, total_amount: 230, labor_cost: 50, discount: 0, paid_amount: 0, status: 'pending_payment', notes: 'العميل معترض على سعر الفحمات', created_at: new Date(Date.now() - 3.6e6).toISOString(), created_by: 'أحمد الاستقبال', delivery_date: null, logs: '[]' }),
    _mapOrder({ id: 'WO-1003', customer_info: 'فيصل 0503333333', car_plate: 'KSA 1', car_model: 'مرسيدس S', services: s1, total_amount: 200, labor_cost: 100, discount: 50, paid_amount: 200, status: 'in_progress', notes: 'إحضار زيت مخصص من العميل', created_at: new Date(Date.now() - 86400000).toISOString(), created_by: 'المدير العام', delivery_date: new Date(Date.now() + 86400000).toISOString(), logs: '[]' }),
    _mapOrder({ id: 'WO-1004', customer_info: 'محمد 0504444444', car_plate: 'DEF 456', car_model: 'سوناتا', services: s2, total_amount: 180, labor_cost: 0, discount: 0, paid_amount: 180, status: 'ready_for_delivery', notes: '', created_at: new Date(Date.now() - 172800000).toISOString(), created_by: 'خالد ميكانيكي', delivery_date: new Date(Date.now() - 3.6e6).toISOString(), logs: '[]' }),
  ];
};

const MOCK_PROFILES = [
  { id: 'demo-admin-id', full_name: 'المدير العام (تجريبي)', email: 'admin@amancar.com', role: 'admin', permissions: {}, created_at: new Date().toISOString() },
  { id: 'u2', full_name: 'خالد ميكانيكي (تجريبي)', email: 'tech@amancar.com', role: 'technician', permissions: {}, created_at: new Date().toISOString() },
  { id: 'u3', full_name: 'سالم المحاسب (تجريبي)', email: 'acc@amancar.com', role: 'accountant', permissions: { viewServices: true }, created_at: new Date().toISOString() },
];

/* ── Cache ── */
let _ordersCache = null;
let _servicesCache = [];
let _profilesCache = null;

/* ── Helpers ── */
function _mapOrder(row) {
  if (!row) return null;
  const parsedSvcs = typeof row.services === 'string' ? (() => { try { return JSON.parse(row.services); } catch { return []; } })() : (row.services || []);
  const parsedLogs = typeof row.logs === 'string' ? (() => { try { return JSON.parse(row.logs); } catch { return []; } })() : (row.logs || []);
  return {
    id: row.id,
    customerInfo: row.customer_info,
    carPlate: row.car_plate,
    carModel: row.car_model,
    services: parsedSvcs,
    totalAmount: Number(row.total_amount) || 0,
    laborCost: Number(row.labor_cost) || 0,
    discount: Number(row.discount) || 0,
    notes: row.notes || '',
    paidAmount: Number(row.paid_amount) || 0,
    deliveryDate: row.delivery_date || null,
    status: row.status,
    createdAt: row.created_at,
    createdBy: row.created_by,
    logs: Array.isArray(parsedLogs) ? parsedLogs : [],
  };
}

/* ── Auth ── */
export const Database = {

  async getCurrentSession() {
    if (isDemoMode) {
      return { id: 'demo-admin-id', email: 'admin@amancar.com', name: 'المدير العام (نموذج تجريبي)', role: 'admin', avatarUrl: null };
    }
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!session) return null;
      const profile = await this._getProfile(session.user.id);
      return {
        id: session.user.id,
        email: session.user.email,
        name: profile?.full_name || 'موظف',
        role: profile?.role || 'pending',
        avatarUrl: profile?.avatar_url || null,
        permissions: profile?.permissions || {},
      };
    } catch (e) {
      console.error('Session error:', e);
      return null;
    }
  },

  async login(email, password) {
    if (isDemoMode) return { id: 'demo-admin-id', email, name: 'المدير العام (تجريبي)', role: 'admin', avatarUrl: null };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    const profile = await this._getProfile(data.user.id);
    return {
      id: data.user.id,
      email: data.user.email,
      name: profile?.full_name || 'موظف',
      role: profile?.role || 'pending',
      avatarUrl: profile?.avatar_url || null,
      permissions: profile?.permissions || {},
    };
  },

  async logout() {
    if (!isDemoMode) await supabase.auth.signOut();
  },

  async registerAccount(email, password, fullName) {
    if (isDemoMode) throw new Error('لم يتم تكوين الاتصال بقاعدة البيانات.');
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, role: 'pending' } } });
    if (error) throw new Error(error.message);
  },

  async _getProfile(userId) {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      return data;
    } catch { return null; }
  },

  /* ── Profiles ── */
  async getProfiles() {
    if (isDemoMode) return MOCK_PROFILES;
    if (_profilesCache) return _profilesCache;
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      _profilesCache = data || [];
      if (_profilesCache.length === 0) {
        const u = await this.getCurrentSession();
        if (u) _profilesCache.push({ id: u.id, full_name: u.name, email: u.email, role: u.role, permissions: u.permissions || {}, created_at: new Date().toISOString() });
      }
      return _profilesCache;
    } catch (e) {
      console.error('getProfiles error:', e);
      return [];
    }
  },

  async updateUserRole(userId, newRole) {
    if (isDemoMode) { const p = MOCK_PROFILES.find(x => x.id === userId); if (p) p.role = newRole; _profilesCache = null; return; }
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) throw new Error(error.message);
    _profilesCache = null;
  },

  async updateUserPermissions(userId, permissions) {
    if (isDemoMode) { const p = MOCK_PROFILES.find(x => x.id === userId); if (p) p.permissions = permissions; _profilesCache = null; return; }
    const { error } = await supabase.from('profiles').update({ permissions }).eq('id', userId);
    if (error) throw new Error(error.message);
    _profilesCache = null;
  },

  async createUserAccount(email, password, fullName, role) {
    if (isDemoMode) { MOCK_PROFILES.unshift({ id: 'u' + Date.now(), full_name: fullName, email, role, created_at: new Date().toISOString() }); _profilesCache = null; return; }
    const tempClient = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await tempClient.auth.signUp({ email, password, options: { data: { full_name: fullName, role } } });
    if (error) {
      if (error.message.toLowerCase().includes('rate limit')) throw new Error(window.t('RATE_LIMIT_ERROR'));
      throw new Error(error.message);
    }
    if (data?.user) {
      try {
        const client = data.session ? tempClient : supabase;
        await client.from('profiles').insert({ id: data.user.id, full_name: fullName, role }).maybeSingle();
      } catch (e) { console.warn('Profile insert warning:', e); }
    }
    _profilesCache = null;
  },

  async updateProfileSettings(userId, fullName, newPassword) {
    if (isDemoMode) return;
    if (fullName) {
      const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', userId);
      if (error) throw new Error(error.message);
    }
    if (newPassword) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
    }
    _profilesCache = null;
  },

  async updateProfileAvatar(userId, base64Url) {
    if (isDemoMode) return;
    const { error } = await supabase.from('profiles').update({ avatar_url: base64Url }).eq('id', userId);
    if (error) throw new Error(error.message);
  },

  /* ── Services ── */
  async getServices() {
    if (isDemoMode) return MOCK_SERVICES;
    if (_servicesCache.length > 0) return _servicesCache;
    try {
      const { data, error } = await supabase.from('services').select('*').neq('is_archived', true).order('created_at', { ascending: true });
      if (error) throw error;
      _servicesCache = [...(data || []), ...MOCK_SERVICES.filter(m => !(data || []).some(d => d.id === m.id))];
      return _servicesCache;
    } catch (e) {
      console.error('getServices error:', e);
      return MOCK_SERVICES;
    }
  },

  async addService(name, price, icon) {
    if (isDemoMode) { const s = { id: 's' + Date.now(), name, price, icon, created_at: new Date().toISOString() }; _servicesCache.push(s); return s; }
    const { data, error } = await supabase.from('services').insert([{ name, price, icon }]).select().single();
    if (error) throw new Error(error.message);
    _servicesCache = [];
    return data;
  },

  async updateService(id, name, price, icon) {
    if (isDemoMode) { const s = _servicesCache.find(x => x.id === id); if (s) { s.name = name; s.price = price; s.icon = icon; } return; }
    const { error } = await supabase.from('services').update({ name, price, icon }).eq('id', id);
    if (error) throw new Error(error.message);
    _servicesCache = [];
  },

  async deleteService(id) {
    if (isDemoMode) { _servicesCache = _servicesCache.filter(s => s.id !== id); return; }
    const { error } = await supabase.from('services').update({ is_archived: true }).eq('id', id);
    if (error) throw new Error(error.message);
    _servicesCache = [];
  },

  /* ── Orders ── */
  async getOrders(forceRefresh = false) {
    if (isDemoMode) return _ordersCache || (_ordersCache = _buildMockOrders());
    if (!forceRefresh && _ordersCache) return _ordersCache;
    try {
      const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      _ordersCache = (data || []).map(_mapOrder);
      return _ordersCache;
    } catch (e) {
      console.error('getOrders error:', e);
      return _ordersCache || [];
    }
  },

  invalidateOrdersCache() { _ordersCache = null; },

  async addOrder(orderData) {
    if (isDemoMode) {
      const newOrd = _mapOrder({ id: `WO-${Math.floor(1000 + Math.random() * 9000)}`, customer_info: orderData.customerInfo, car_plate: orderData.carPlate, car_model: orderData.carModel, services: JSON.stringify(orderData.services), total_amount: orderData.totalAmount, labor_cost: orderData.laborCost || 0, discount: orderData.discount || 0, notes: orderData.notes || '', paid_amount: 0, status: orderData.status || 'pending_payment', created_by: orderData.createdBy, created_at: new Date().toISOString(), delivery_date: null, logs: '[]' });
      if (!_ordersCache) _ordersCache = _buildMockOrders();
      _ordersCache.unshift(newOrd);
      return newOrd;
    }
    const id = `WO-${Math.floor(1000 + Math.random() * 9000)}`;
    const payload = { id, customer_info: orderData.customerInfo, car_plate: orderData.carPlate, car_model: orderData.carModel, services: orderData.services, total_amount: orderData.totalAmount, labor_cost: orderData.laborCost || 0, discount: orderData.discount || 0, notes: orderData.notes || '', paid_amount: 0, status: orderData.status || 'pending_payment', created_by: orderData.createdBy, logs: [{ status: orderData.status || 'pending_payment', timestamp: new Date().toISOString(), by: orderData.createdBy }] };
    const { data, error } = await supabase.from('orders').insert([payload]).select().maybeSingle();
    if (error) throw new Error(error.message);
    _ordersCache = null;
    return _mapOrder(data);
  },

  async updateOrder(id, orderData) {
    if (isDemoMode) {
      if (!_ordersCache) _ordersCache = _buildMockOrders();
      const idx = _ordersCache.findIndex(o => o.id === id);
      if (idx === -1) return null;
      const old = _ordersCache[idx];
      let status = old.status;
      if (old.status !== 'draft' && old.totalAmount !== orderData.totalAmount) status = 'pending_payment';
      _ordersCache[idx] = { ...old, customerInfo: orderData.customerInfo, carPlate: orderData.carPlate, carModel: orderData.carModel, services: orderData.services, totalAmount: orderData.totalAmount, laborCost: orderData.laborCost || 0, discount: orderData.discount || 0, notes: orderData.notes || '', status };
      return _ordersCache[idx];
    }
    const { data: current, error: fe } = await supabase.from('orders').select('total_amount, status, logs').eq('id', id).maybeSingle();
    if (fe) throw new Error(fe.message);
    let status = orderData.status || current.status;
    const logs = Array.isArray(current.logs) ? current.logs : [];
    if (current.status !== 'draft' && Number(current.total_amount) !== Number(orderData.totalAmount)) { status = 'pending_payment'; logs.push({ status: 'pending_payment', timestamp: new Date().toISOString(), by: orderData.createdBy, note: 'تم تعديل إجمالي الفاتورة' }); }
    const { data, error } = await supabase.from('orders').update({ customer_info: orderData.customerInfo, car_plate: orderData.carPlate, car_model: orderData.carModel, services: orderData.services, total_amount: orderData.totalAmount, labor_cost: orderData.laborCost || 0, discount: orderData.discount || 0, notes: orderData.notes || '', status, logs }).eq('id', id).select().maybeSingle();
    if (error) throw new Error(error.message);
    _ordersCache = null;
    return _mapOrder(data);
  },

  async updateOrderStatus(id, newStatus, byUser, deliveryDate = null) {
    if (isDemoMode) {
      if (!_ordersCache) _ordersCache = _buildMockOrders();
      const order = _ordersCache.find(o => o.id === id);
      if (!order) return null;
      if (['paid_ready', 'in_progress'].includes(newStatus) && order.totalAmount > 0 && order.paidAmount === 0) {
        throw new Error('لا يمكن بدء العمل قبل سداد دفعة مقدمة على الأقل');
      }
      if (newStatus === 'closed' && (order.totalAmount - order.paidAmount > 0)) {
        throw new Error('لا يمكن تسليم السيارة، يوجد مبلغ متبقي غير مسدد');
      }
      order.status = newStatus;
      if (deliveryDate !== null) order.deliveryDate = deliveryDate;
      order.logs.push({ status: newStatus, timestamp: new Date().toISOString(), by: byUser });
      return order;
    }
    const { data: current } = await supabase.from('orders').select('logs, paid_amount, total_amount').eq('id', id).maybeSingle();
    if (['paid_ready', 'in_progress'].includes(newStatus) && Number(current?.total_amount || 0) > 0 && Number(current?.paid_amount || 0) === 0) {
      throw new Error('لا يمكن بدء العمل قبل سداد دفعة مقدمة على الأقل');
    }
    if (newStatus === 'closed' && (Number(current?.total_amount || 0) - Number(current?.paid_amount || 0) > 0)) {
      throw new Error('لا يمكن تسليم السيارة، يوجد مبلغ متبقي غير مسدد');
    }
    const logs = Array.isArray(current?.logs) ? current.logs : [];
    logs.push({ status: newStatus, timestamp: new Date().toISOString(), by: byUser });
    const payload = { status: newStatus, logs };
    if (deliveryDate !== null) payload.delivery_date = deliveryDate;
    if (newStatus === 'closed' && !payload.delivery_date) payload.delivery_date = new Date().toISOString();
    const { data, error } = await supabase.from('orders').update(payload).eq('id', id).select().maybeSingle();
    if (error) throw new Error(error.message);
    _ordersCache = null;
    return _mapOrder(data);
  },

  async processPayment(id, amountPaid, byUser = 'Accountant') {
    if (isDemoMode) {
      if (!_ordersCache) _ordersCache = _buildMockOrders();
      const order = _ordersCache.find(o => o.id === id);
      if (!order) return null;
      order.paidAmount = order.paidAmount + amountPaid;
      if (order.paidAmount >= order.totalAmount && order.status !== 'closed' && order.status !== 'ready_for_delivery') order.status = 'paid_ready';
      else if (order.paidAmount > 0 && order.paidAmount < order.totalAmount) order.status = 'partially_paid';
      
      const noteText = amountPaid < 0 ? `تم رد الفائض: ${Math.abs(amountPaid)} ريال` : `Payment: ${amountPaid} SAR`;
      order.logs.push({ status: order.status, timestamp: new Date().toISOString(), by: byUser, note: noteText });
      return order;
    }
    const { data: current } = await supabase.from('orders').select('paid_amount, total_amount, status, logs').eq('id', id).maybeSingle();
    if (!current) return null;
    let newPaid = Number(current.paid_amount) + amountPaid;
    const total = Number(current.total_amount);
    let newStatus = current.status;
    const logs = Array.isArray(current.logs) ? current.logs : [];
    
    // Check if status should change based on payment or refund
    if (['pending_payment', 'partially_paid'].includes(current.status) || amountPaid < 0) {
      if (newPaid >= total) {
        if (!['closed', 'ready_for_delivery'].includes(current.status)) {
          newStatus = 'paid_ready';
        }
      } else if (newPaid > 0) {
        newStatus = 'partially_paid';
      } else {
        newStatus = 'pending_payment';
      }
    }
    
    const noteText = amountPaid < 0 ? `تم رد الفائض: ${Math.abs(amountPaid)} ريال` : `Payment: ${amountPaid} SAR`;
    logs.push({ status: newStatus, timestamp: new Date().toISOString(), by: byUser, note: noteText });
    
    const { data, error } = await supabase.from('orders').update({ paid_amount: newPaid, status: newStatus, logs }).eq('id', id).select().maybeSingle();
    if (error) throw new Error(error.message);
    _ordersCache = null;
    return _mapOrder(data);
  },

  async addOrderNote(id, noteText, byUser, attachmentUrl = null, attachmentName = null) {
    if (isDemoMode) {
      if (!_ordersCache) _ordersCache = _buildMockOrders();
      const order = _ordersCache.find(o => o.id === id);
      if (!order) return null;
      order.logs.push({ status: 'internal_note', text: noteText, attachmentUrl, attachmentName, timestamp: new Date().toISOString(), by: byUser });
      return order;
    }
    const { data: current } = await supabase.from('orders').select('logs').eq('id', id).maybeSingle();
    const logs = Array.isArray(current?.logs) ? current.logs : [];
    logs.push({ status: 'internal_note', text: noteText, attachmentUrl, attachmentName, timestamp: new Date().toISOString(), by: byUser });
    const { error } = await supabase.from('orders').update({ logs }).eq('id', id);
    if (error) throw new Error(error.message);
    _ordersCache = null;
    return true;
  },

  async reassignTechnician(id, newTechName, byUser) {
    if (isDemoMode) {
      if (!_ordersCache) _ordersCache = _buildMockOrders();
      const order = _ordersCache.find(o => o.id === id);
      if (!order) return;
      order.createdBy = newTechName;
      order.logs.push({ status: 'technician_reassigned', timestamp: new Date().toISOString(), by: byUser, note: `تم التحويل إلى: ${newTechName}` });
      return;
    }
    const { data: current } = await supabase.from('orders').select('logs').eq('id', id).maybeSingle();
    const logs = Array.isArray(current?.logs) ? current.logs : [];
    logs.push({ status: 'technician_reassigned', timestamp: new Date().toISOString(), by: byUser, note: `تم التحويل إلى: ${newTechName}` });
    const { error } = await supabase.from('orders').update({ created_by: newTechName, logs }).eq('id', id);
    if (error) throw new Error(error.message);
    _ordersCache = null;
  },

  async uploadNoteAttachment(orderId, file) {
    if (isDemoMode || !file) return { url: null, name: null };
    try {
      const ext = file.name.split('.').pop();
      const path = `notes/${orderId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('attachments').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('attachments').getPublicUrl(path);
      return { url: data.publicUrl, name: file.name };
    } catch (e) {
      console.warn('Attachment upload failed:', e);
      return { url: null, name: file.name };
    }
  },
};
