'use strict';

document.addEventListener('DOMContentLoaded', () => {
    
  const user = App.requireAuth('salesman');
  if (!user) return; // redirected

  // Setup UI Header
  document.getElementById('user-name').textContent = user.name;
  document.getElementById('user-initial').textContent = user.name.charAt(0).toUpperCase();

  // State
  let cart = {}; // flavour_id -> quantity
  let dateToday = CR.todayStr();

  // DOM
  const domFlavourGrid = document.getElementById('flavour-grid');
  const domCartContainer = document.getElementById('cart-container');
  const domCartItems = document.getElementById('cart-items');
  const domCartTotal = document.getElementById('cart-total');
  
  const statRev = document.getElementById('stat-revenue');
  const statBot = document.getElementById('stat-bottles');
  const statOrd = document.getElementById('stat-orders');
  
  const domOrdersList = document.getElementById('orders-list');
  const histDate = document.getElementById('hist-date');
  const histContainer = document.getElementById('hist-container');

  // Init
  histDate.value = dateToday;
  renderFlavours();
  refreshDashboard();

  // Tabs logic
  document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          tab.classList.add('active');
          document.getElementById(tab.dataset.target).classList.add('active');
          if(tab.dataset.target === 'tab-history') refreshHistory();
      });
  });

  // ---- RENDERERS ----

  function renderFlavours() {
      domFlavourGrid.innerHTML = '';
      CR.FLAVOURS.forEach(f => {
          const c = document.createElement('div');
          c.className = `flavour-card ${f.cls}`;
          
          let qty = cart[f.id] || 0;
          
          c.innerHTML = `
              <img src="${f.img}" class="fl-img" alt="${f.name}">
              <div class="flex jcb">
                  <div>
                      <div class="fl-name">${f.name}</div>
                      <div class="fl-price">₹${f.price}</div>
                  </div>
                  <div class="qty-row">
                      <button class="qty-btn" onclick="updateCart('${f.id}', -1)">-</button>
                      <div class="qty-val" id="qty-${f.id}">${qty}</div>
                      <button class="qty-btn" onclick="updateCart('${f.id}', 1)">+</button>
                  </div>
              </div>
          `;
          domFlavourGrid.appendChild(c);
      });
  }

  window.updateCart = function(fId, delta) {
      if(!cart[fId]) cart[fId] = 0;
      cart[fId] += delta;
      if(cart[fId] < 0) cart[fId] = 0;
      
      const qtyEl = document.getElementById(`qty-${fId}`);
      if(qtyEl) qtyEl.textContent = cart[fId];
      
      renderCart();
  };

  function renderCart() {
      let itemsHtml = '';
      let total = 0;
      let hasItems = false;
      
      CR.FLAVOURS.forEach(f => {
          const qty = cart[f.id] || 0;
          if(qty > 0) {
              hasItems = true;
              const sub = qty * f.price;
              total += sub;
              itemsHtml += `
                  <div class="cart-row">
                      <div class="cart-row-name">${qty}x ${f.emoji} ${f.name}</div>
                      <div class="cart-row-price">₹${sub}</div>
                  </div>
              `;
          }
      });
      
      if(hasItems) {
          domCartItems.innerHTML = itemsHtml;
          domCartTotal.textContent = `₹${total}`;
          domCartContainer.style.display = 'block';
      } else {
          domCartContainer.style.display = 'none';
      }
  }

  // ---- ACTIONS ----
  
  document.getElementById('btn-clear-cart').addEventListener('click', () => {
      cart = {};
      renderFlavours();
      renderCart();
  });

  document.getElementById('btn-confirm-order').addEventListener('click', () => {
      const items = [];
      CR.FLAVOURS.forEach(f => {
          const q = cart[f.id] || 0;
          if(q > 0) {
              items.push({
                  flavour: f.name,
                  quantity: q,
                  price: f.price,
                  subtotal: q * f.price
              });
          }
      });
      
      if(items.length === 0) return;
      
      CR.addOrder(user.id, items);
      App.toast('Order confirmed successfully!');
      
      cart = {};
      renderFlavours();
      renderCart();
      refreshDashboard();
  });

  // ---- DASHBOARD ----

  function refreshDashboard() {
      const sales = CR.getSales(user.id, dateToday);
      
      statRev.textContent = `₹${sales.summary.totalRevenue}`;
      statBot.textContent = sales.summary.totalBottles;
      statOrd.textContent = sales.orders.length;
      
      if(sales.orders.length === 0) {
          domOrdersList.innerHTML = `<div class="empty">
              <div class="empty-txt">No orders yet today</div>
          </div>`;
          return;
      }
      
      let oh = '';
      const recent = [...sales.orders].reverse().slice(0, 5); // top 5
      recent.forEach((o, i) => {
          const txt = o.items.map(it => `${it.quantity}x ${it.flavour}`).join(', ');
          oh += `
              <div class="order-card">
                  <div class="order-hd">
                      <span class="order-num">Order #${sales.orders.length - i}</span>
                      <span class="order-tm">${CR.fmtTime(o.timestamp)}</span>
                  </div>
                  <div class="order-items">${txt}</div>
                  <div class="order-amt">₹${o.total}</div>
              </div>
          `;
      });
      domOrdersList.innerHTML = oh;
  }

  window.voidOrder = function(id) {
      if(confirm('Are you sure you want to VOID this order? This will remove it from the total.')) {
          const success = CR.voidOrder(user.id, id);
          if(success) {
              App.toast('Order voided successfully.');
              refreshDashboard();
          }
      }
  };

  // ---- SIGN OUT ----

  const modalSignout = document.getElementById('modal-signout');
  
  document.getElementById('btn-signout').addEventListener('click', () => {
      const sales = CR.getSales(user.id, dateToday);
      document.getElementById('report-total').textContent = `₹${sales.summary.totalRevenue}`;
      
      let bd = '';
      Object.entries(sales.summary.perFlavour).forEach(([flName, st]) => {
          bd += `
            <div class="report-row">
                <span>${flName}</span>
                <span>${st.bottles} btl &nbsp;|&nbsp; ₹${st.revenue}</span>
            </div>
          `;
      });
      
      if(bd === '') bd = '<div class="tc c3 fs12">No sales today</div>';
      
      bd += `
        <div class="report-row mt12" style="border-top:2px solid var(--border); padding-top:10px;">
            <span>TOTAL BOTTLES</span>
            <span>${sales.summary.totalBottles}</span>
        </div>
      `;
      
      document.getElementById('report-details').innerHTML = bd;
      modalSignout.classList.remove('hidden');
  });

  document.getElementById('btn-cancel-signout').addEventListener('click', () => {
      modalSignout.classList.add('hidden');
  });

  document.getElementById('btn-confirm-signout').addEventListener('click', () => {
      App.logout();
  });

  // ---- HISTORY ----
  
  histDate.addEventListener('change', refreshHistory);

  function refreshHistory() {
      const d = histDate.value;
      const sales = CR.getSales(user.id, d);
      
      let html = '';
      if(sales.orders.length === 0) {
          html = `<div class="empty"><div class="empty-txt">No sales recorded for this date.</div></div>`;
      } else {
          html += `
            <div class="stats-grid mb20">
                <div class="stat-card green"><div class="stat-val fs20">₹${sales.summary.totalRevenue}</div><div class="stat-lbl">Revenue</div></div>
                <div class="stat-card orange"><div class="stat-val fs20">${sales.summary.totalBottles}</div><div class="stat-lbl">Bottles</div></div>
                <div class="stat-card gold"><div class="stat-val fs20">${sales.orders.length}</div><div class="stat-lbl">Orders</div></div>
            </div>
            <div class="divider"></div>
          `;
          const orders = [...sales.orders].reverse();
          orders.forEach((o, i) => {
              const txt = o.items.map(it => `${it.quantity}x ${it.flavour}`).join(', ');
              const isToday = d === dateToday;
              const isLast = i === 0;
              html += `
                <div class="order-card">
                    <div class="order-hd">
                        <span class="order-num">Order #${sales.orders.length - i}</span>
                        <span class="order-tm">${CR.fmtTime(o.timestamp)}</span>
                    </div>
                    <div class="order-items">${txt}</div>
                    <div class="flex jcb aic">
                        <div class="order-amt">₹${o.total}</div>
                        ${(isToday && isLast) ? `<button class="btn btn-danger btn-sm" onclick="voidOrder('${o.id}')" style="padding:4px 10px; font-size:10px;">Void Order</button>` : ''}
                    </div>
                </div>
              `;
          });
      }
      histContainer.innerHTML = html;
  }

});
