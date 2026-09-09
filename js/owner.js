'use strict';

document.addEventListener('DOMContentLoaded', () => {

    const user = App.requireAuth('owner');
    if(!user) return;
    
    // UI Init
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-initial').textContent = user.name.charAt(0).toUpperCase();

    const filterDate = document.getElementById('filter-date');
    filterDate.value = CR.todayStr();
    
    // Setup Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.target).classList.add('active');
        });
    });

    // Setup Sign Out
    document.getElementById('btn-signout').addEventListener('click', () => {
        App.logout();
    });

    window.addEventListener('storage', (e) => {
        if(e.key && e.key.startsWith('cr_sales_')) {
            refreshData();
            if(e.newValue) {
                const data = JSON.parse(e.newValue);
                const salesmanId = e.key.split('_')[2];
                const sm = CR.getUserById(salesmanId);
                const latestOrder = data.orders[data.orders.length - 1];
                if(latestOrder) addFeedItem(sm.name, latestOrder);
            }
        }
    });

    function addFeedItem(name, order) {
        const feed = document.getElementById('live-feed-list');
        const item = document.createElement('div');
        item.className = 'feed-item';
        const txt = order.items.map(it => `${it.quantity}x ${it.flavour}`).join(', ');
        item.innerHTML = `
            <div class="feed-txt"><strong>${name}</strong> sold ${txt} for <strong>₹${order.total}</strong></div>
            <div class="feed-time">${CR.fmtTime(order.timestamp)}</div>
        `;
        feed.prepend(item);
        if(feed.children.length > 20) feed.lastElementChild.remove();
    }

    filterDate.addEventListener('change', () => {
        refreshData();
    });

    // Setup Add Salesman
    document.getElementById('form-add-salesman').addEventListener('submit', (e) => {
        e.preventDefault();
        const nm = document.getElementById('n-name').value.trim();
        const em = document.getElementById('n-email').value.trim();
        const pw = document.getElementById('n-pass').value;

        const res = CR.addUser({ name:nm, email:em, password:pw, role:'salesman' });
        if(res.error) {
            App.toast(res.error, 'err');
        } else {
            App.toast('Salesman added successfully!');
            document.getElementById('form-add-salesman').reset();
            refreshData();
        }
    });
    
    // Navigation inside Team tab
    document.getElementById('btn-back-team').addEventListener('click', () => {
        document.getElementById('team-detail').style.display = 'none';
        document.getElementById('team-list').style.display = 'block';
    });

    // Fetch and render everything
    function refreshData() {
        const d = filterDate.value;
        const allSales = CR.getAllSalesForDate(d);
        const { totalBottles, totalRevenue, activeSalesmen, totalSalesmen } = CR.getTotalsForDate(d);

        // Update counts
        document.getElementById('t-count').textContent = totalSalesmen;
        
        // Update DASH Top Stats
        document.getElementById('st-rev').textContent = `₹${totalRevenue}`;
        document.getElementById('st-btl').textContent = totalBottles;
        document.getElementById('st-act').textContent = `${activeSalesmen} / ${totalSalesmen}`;

        // Aggregate flavours
        const flavAgg = {};
        allSales.forEach(s => {
            Object.entries(s.sales.summary.perFlavour).forEach(([fl, st]) => {
                if(!flavAgg[fl]) flavAgg[fl] = { bottles:0, revenue:0 };
                flavAgg[fl].bottles += st.bottles;
                flavAgg[fl].revenue += st.revenue;
            });
        });

        // Render Flavour Demographics
        const maxBtl = Math.max(...Object.values(flavAgg).map(x => x.bottles), 1); // avoid /0
        let flavHtml = '';
        if(Object.keys(flavAgg).length === 0) {
            flavHtml = '<div class="c3 fs13 tc">No sales data for this date</div>';
        } else {
            // Sort by bottles desc
            const sortedFl = Object.entries(flavAgg).sort((a,b) => b[1].bottles - a[1].bottles);
            sortedFl.forEach(([fl, st]) => {
                const pct = (st.bottles / maxBtl) * 100;
                const col = CR.FLAVOUR_COLORS[fl] || 'var(--green)';
                flavHtml += `
                    <div class="bar-item">
                        <div class="bar-hd">
                            <span class="bar-name">${fl}</span>
                            <span class="bar-stats">${st.bottles} btl &nbsp; (₹${st.revenue})</span>
                        </div>
                        <div class="bar-track">
                            <div class="bar-fill" style="width:${pct}%; background:${col}"></div>
                        </div>
                    </div>
                `;
            });
        }
        document.getElementById('dash-flavours').innerHTML = flavHtml;

        // Render Dash Salesmen List
        renderDashSalesmen(allSales);

        // Render Team List
        renderTeamList(allSales);
    }

    function renderDashSalesmen(allSales) {
        let html = '';
        if(allSales.length === 0) html = '<div class="c3 fs13 tc card card-p">No salesmen active</div>';
        
        // sort by revenue desc
        const sorted = [...allSales].sort((a,b) => b.sales.summary.totalRevenue - a.sales.summary.totalRevenue);
        
        sorted.forEach(s => {
            const hasSales = s.sales.summary.totalBottles > 0;
            html += `
                <div class="card card-p" style="padding:15px; display:flex; justify-content:space-between; align-items:center;">
                    <div class="flex aic gap10">
                        <div class="sm-av" style="width:36px; height:36px; font-size:14px;">${s.salesman.name.charAt(0)}</div>
                        <div>
                            <div class="fs14 fw6">${s.salesman.name}</div>
                            <div class="fs12 c3">${hasSales ? 'Active' : 'No sales yet'}</div>
                        </div>
                    </div>
                    <div class="tc">
                        <div class="fs16 fw7 cg">₹${s.sales.summary.totalRevenue}</div>
                        <div class="fs11 c3">${s.sales.summary.totalBottles} bottles</div>
                    </div>
                </div>
            `;
        });
        document.getElementById('dash-salesmen-list').innerHTML = html;
    }

    function renderTeamList(allSales) {
        let html = '';
        const listContainer = document.getElementById('team-list');
        listContainer.innerHTML = ''; // we append properly to attach listeners
        
        if (allSales.length === 0) {
            listContainer.innerHTML = '<div class="c3 tc p24">No salesmen registered. Go to Add Salesman.</div>';
            return;
        }

        allSales.forEach(s => {
            const c = document.createElement('div');
            c.className = 'sm-card';
            c.innerHTML = `
                <div class="sm-info">
                    <div class="sm-av">${s.salesman.name.charAt(0)}</div>
                    <div>
                        <div class="sm-name">${s.salesman.name}</div>
                        <div class="sm-meta">${s.salesman.email}</div>
                    </div>
                </div>
                <div class="sm-stats border-top">
                    <div class="sm-stat">
                        <div class="sm-stat-val">₹${s.sales.summary.totalRevenue}</div>
                        <div class="sm-stat-lbl">Revenue</div>
                    </div>
                    <div class="sm-stat">
                        <div class="sm-stat-val" style="color:var(--orange)">${s.sales.summary.totalBottles}</div>
                        <div class="sm-stat-lbl">Bottles</div>
                    </div>
                </div>
            `;
            c.addEventListener('click', () => showTeamDetail(s));
            listContainer.appendChild(c);
        });
    }

    function showTeamDetail(s) {
        document.getElementById('team-list').style.display = 'none';
        
        document.getElementById('dt-av').textContent = s.salesman.name.charAt(0);
        document.getElementById('dt-name').textContent = s.salesman.name;
        document.getElementById('dt-email').textContent = s.salesman.email;
        
        document.getElementById('dt-rev').textContent = `₹${s.sales.summary.totalRevenue}`;
        document.getElementById('dt-btl').textContent = s.sales.summary.totalBottles;
        document.getElementById('dt-ord').textContent = s.sales.orders.length;

        let oHtml = '';
        if(s.sales.orders.length === 0) {
            oHtml = '<div class="c3 fs13">No orders placed on this date.</div>';
        } else {
            const recent = [...s.sales.orders].reverse();
            recent.forEach((o, i) => {
                const txt = o.items.map(it => `${it.quantity}x ${it.flavour}`).join(', ');
                oHtml += `
                    <div class="order-card">
                        <div class="order-hd">
                            <span class="order-num">Order #${s.sales.orders.length - i}</span>
                            <span class="order-tm">${CR.fmtTime(o.timestamp)}</span>
                        </div>
                        <div class="order-items">${txt}</div>
                        <div class="order-amt">₹${o.total}</div>
                    </div>
                `;
            });
        }
        document.getElementById('dt-orders-list').innerHTML = oHtml;

        document.getElementById('team-detail').style.display = 'block';
    }

    // Initial fetch
    refreshData();
    
    // Fill initial feed
    const today = CR.todayStr();
    const all = CR.getAllSalesForDate(today);
    let allOrders = [];
    all.forEach(s => {
        s.sales.orders.forEach(o => {
            allOrders.push({ name:s.salesman.name, order:o });
        });
    });
    allOrders.sort((a,b) => new Date(a.order.timestamp) - new Date(b.order.timestamp));
    allOrders.slice(-20).forEach(x => addFeedItem(x.name, x.order));
});
