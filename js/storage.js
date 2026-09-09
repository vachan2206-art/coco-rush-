'use strict';

/* =============================================================
   COCO RUSH – Data Storage Layer (localStorage)
   All data lives under the 'cr_' namespace.
   ============================================================= */

const CR = (() => {

  /* ---- CONSTANTS ---- */
  const FLAVOURS = [
    { id: 'classic',  name: 'Classic Coco',       price: 80,  emoji: '🥛', cls: 'fl-classic',  img: 'assets/classic_coco.png'  },
    { id: 'choco',    name: 'Choco Crunch Coco',   price: 100, emoji: '🍫', cls: 'fl-choco',    img: 'assets/choco_crunch.png'  },
    { id: 'dryfruit', name: 'Dry Fruit Coco',       price: 100, emoji: '🥜', cls: 'fl-dryfruit', img: 'assets/dry_fruit.png'    },
    { id: 'mawa',     name: 'Mawa Malai Punch',     price: 100, emoji: '✨', cls: 'fl-mawa',     img: 'assets/mawa_malai.png'    },
    { id: 'gulkand',  name: 'Gulkand Punch',        price: 100, emoji: '🌸', cls: 'fl-gulkand',  img: 'assets/gulkand.png'       },
  ];

  const FLAVOUR_COLORS = {
    'Classic Coco':     '#66BB6A',
    'Choco Crunch Coco':'#A1887F',
    'Dry Fruit Coco':   '#FFAB40',
    'Mawa Malai Punch': '#FFD54F',
    'Gulkand Punch':    '#F48FB1',
  };

  const KEYS = { USERS: 'cr_users', SESSION: 'cr_session' };

  /* ---- HELPERS ---- */
  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function todayStr() {
    // Returns YYYY-MM-DD in local time
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function fmtDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  }

  function fmtTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
  }

  /* ---- INIT ---- */
  function init() {
    if (!localStorage.getItem(KEYS.USERS)) {
      const defaultOwner = {
        id: genId(), name: 'Owner', email: 'owner@cocorush.com',
        password: 'owner123', role: 'owner', createdAt: new Date().toISOString()
      };
      localStorage.setItem(KEYS.USERS, JSON.stringify([defaultOwner]));
    }
  }

  /* ---- USER MANAGEMENT ---- */
  function getUsers()       { return JSON.parse(localStorage.getItem(KEYS.USERS) || '[]'); }
  function saveUsers(list)  { localStorage.setItem(KEYS.USERS, JSON.stringify(list)); }
  function getUserById(id)  { return getUsers().find(u => u.id === id) || null; }
  function getUserByEmail(e){ return getUsers().find(u => u.email.toLowerCase() === e.toLowerCase()) || null; }
  function getSalesmen()    { return getUsers().filter(u => u.role === 'salesman'); }
  function getOwners()      { return getUsers().filter(u => u.role === 'owner'); }

  function addUser(data) {
    const users = getUsers();
    if (users.find(u => u.email.toLowerCase() === data.email.toLowerCase()))
      return { error: 'Email already registered' };
    const user = { id: genId(), ...data, createdAt: new Date().toISOString() };
    users.push(user);
    saveUsers(users);
    return { user };
  }

  function deleteUser(id) {
    saveUsers(getUsers().filter(u => u.id !== id));
  }

  function updateUserPassword(id, newPass) {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return false;
    users[idx].password = newPass;
    saveUsers(users);
    return true;
  }

  /* ---- SESSION ---- */
  function getSession()    { return JSON.parse(localStorage.getItem(KEYS.SESSION) || 'null'); }
  function clearSession()  { localStorage.removeItem(KEYS.SESSION); }
  function setSession(user) {
    const s = { userId:user.id, name:user.name, email:user.email, role:user.role };
    localStorage.setItem(KEYS.SESSION, JSON.stringify(s));
    return s;
  }

  /* ---- SALES DATA ---- */
  function salesKey(uid, date) { return `cr_sales_${uid}_${date}`; }

  function emptySales() {
    return { orders:[], summary:{ totalBottles:0, totalRevenue:0, perFlavour:{} } };
  }

  function getSales(uid, date) {
    const raw = localStorage.getItem(salesKey(uid, date));
    return raw ? JSON.parse(raw) : emptySales();
  }

  function saveSales(uid, date, data) {
    const key = salesKey(uid, date);
    localStorage.setItem(key, JSON.stringify(data));
    // Notify other same-browser tabs
    try {
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(data) }));
    } catch(e) {}
  }

  function addOrder(uid, items) {
    const date = todayStr();
    const data = getSales(uid, date);
    const order = {
      id: genId(),
      items,
      total: items.reduce((s, i) => s + i.subtotal, 0),
      timestamp: new Date().toISOString()
    };
    data.orders.push(order);
    items.forEach(item => {
      data.summary.totalBottles += item.quantity;
      data.summary.totalRevenue += item.subtotal;
      if (!data.summary.perFlavour[item.flavour])
        data.summary.perFlavour[item.flavour] = { bottles:0, revenue:0 };
      data.summary.perFlavour[item.flavour].bottles += item.quantity;
      data.summary.perFlavour[item.flavour].revenue += item.subtotal;
    });
    saveSales(uid, date, data);
    return order;
  }

  function voidOrder(uid, orderId) {
    const date = todayStr();
    const data = getSales(uid, date);
    const idx = data.orders.findIndex(o => o.id === orderId);
    if(idx === -1) return false;
    
    const [order] = data.orders.splice(idx, 1);
    order.items.forEach(item => {
      data.summary.totalBottles -= item.quantity;
      data.summary.totalRevenue -= item.subtotal;
      if (data.summary.perFlavour[item.flavour]) {
        data.summary.perFlavour[item.flavour].bottles -= item.quantity;
        data.summary.perFlavour[item.flavour].revenue -= item.subtotal;
      }
    });
    saveSales(uid, date, data);
    return true;
  }

  function getAvailableDates(uid) {
    const prefix = `cr_sales_${uid}_`;
    const dates = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) dates.push(k.slice(prefix.length));
    }
    return dates.sort().reverse();
  }

  function getAllSalesForDate(date) {
    return getSalesmen().map(s => ({ salesman:s, sales:getSales(s.id, date) }));
  }

  function getTotalsForDate(date) {
    const all = getAllSalesForDate(date);
    let b = 0, r = 0;
    all.forEach(({ sales:sv }) => { b += sv.summary.totalBottles; r += sv.summary.totalRevenue; });
    return {
      totalBottles: b,
      totalRevenue: r,
      activeSalesmen: all.filter(s => s.sales.summary.totalBottles > 0).length,
      totalSalesmen: all.length
    };
  }

  /* ---- EXPOSE ---- */
  return {
    FLAVOURS, FLAVOUR_COLORS, KEYS,
    init, genId, todayStr, fmtDate, fmtTime,
    getUsers, saveUsers, getUserById, getUserByEmail, getSalesmen, getOwners,
    addUser, deleteUser, updateUserPassword,
    getSession, setSession, clearSession,
    salesKey, emptySales, getSales, saveSales, addOrder, voidOrder,
    getAvailableDates, getAllSalesForDate, getTotalsForDate,
  };
})();
