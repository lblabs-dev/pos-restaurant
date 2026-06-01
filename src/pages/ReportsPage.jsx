import { useState, useEffect, useCallback } from 'react';
import { BarChart2, TrendingUp, ShoppingBag, ChevronDown, ChevronRight, Printer } from 'lucide-react';
import { db } from '../lib/db';
import { useAuth } from '../contexts/AuthContext';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage({ onToast }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [filterUserId, setFilterUserId] = useState(null);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [details, setDetails] = useState({});

  useEffect(() => {
    if (isAdmin) db.getUsers().then(setUsers).catch(() => { });
  }, [isAdmin]);

  const load = useCallback(async () => {
    try {
      const uid = isAdmin ? filterUserId : user?.id ?? null;
      const [ords, sett] = await Promise.all([
        db.getOrdersHistory(from, to, uid),
        db.getSettings(),
      ]);
      setOrders(ords);
      setSettings(sett);
    } catch (e) { onToast(String(e), 'error'); }
  }, [from, to, filterUserId, onToast, isAdmin, user]);

  useEffect(() => { load(); }, [load]);

  const currency = settings.currency || '$';
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);

  const printUserReport = async () => {
    try {
      const uid = isAdmin ? (filterUserId || user?.id) : user?.id;
      if (!uid) return onToast('Select a user to print report', 'error');
      const report = await db.getUserReport(uid, from, to);
      const restName = settings.find ? settings.find(s => s.key === 'restaurant_name')?.value : (Array.isArray(settings) ? (settings.find(s => s.key === 'restaurant_name')?.value) : settings.restaurant_name) || 'Restaurant';
      const w = window.open('', '_blank', 'width=500,height=700');
      w.document.write(`<html><head><title>User Report</title><style>
        body{font-family:monospace;font-size:13px;padding:1rem}
        h2,h3{margin:0.25rem 0}
        table{width:100%;border-collapse:collapse;margin-top:0.5rem}
        td,th{padding:2px 4px;text-align:left}
        hr{border:1px dashed #000}
      </style></head><body>
        <h2>${restName}</h2>
        <h3>Staff Report: ${report.full_name || report.user_name}</h3>
        <p>Period: ${from} to ${to}</p>
        <hr/>
        <p>Total Orders: ${report.total_orders}</p>
        <p>Total Revenue: ${currency}${Number(report.total_revenue).toFixed(2)}</p>
        <hr/>
        ${report.orders.map(o => `<p>#${o.id} Table ${o.table_number ?? '—'} — ${currency}${Number(o.total).toFixed(2)}</p>`).join('')}
      </body></html>`);
      w.document.close();
      w.print();
    } catch (e) { onToast(String(e), 'error'); }
  };

  async function toggleExpand(orderId) {
    if (expanded === orderId) { setExpanded(null); return; }
    setExpanded(orderId);
    if (!details[orderId]) {
      try {
        const d = await db.getOrderDetails(orderId);
        setDetails(prev => ({ ...prev, [orderId]: d }));
      } catch (e) { onToast(String(e), 'error'); }
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Reports</h1>
        <div className="flex items-center gap-1" style={{ flexWrap: 'wrap' }}>
          <label className="text-sm text-muted">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: '0.4rem 0.6rem' }} />
          <label className="text-sm text-muted">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: '0.4rem 0.6rem' }} />
          {isAdmin && (
            <select
              value={filterUserId ?? ''}
              onChange={e => setFilterUserId(e.target.value ? Number(e.target.value) : null)}
              style={{ padding: '0.4rem 0.6rem' }}
            >
              <option value="">All Users</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.username}</option>)}
            </select>
          )}
          <button className="btn btn-primary btn-sm" onClick={load}>Apply</button>
          <button className="btn btn-ghost btn-sm" onClick={printUserReport} title="Print user report">
            <Printer size={14} />
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value text-primary">{currency}{totalRevenue.toFixed(2)}</div>
            <div className="stat-sub">{from === to ? 'Today' : `${from} – ${to}`}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Orders Closed</div>
            <div className="stat-value">{orders.length}</div>
            <div className="stat-sub">Completed orders</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg. Order Value</div>
            <div className="stat-value">{orders.length ? (currency + (totalRevenue / orders.length).toFixed(2)) : '—'}</div>
            <div className="stat-sub">Per closed order</div>
          </div>
        </div>

        {/* Orders list */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Order</th>
                <th>Table</th>
                <th>Closed At</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={5}>
                  <div className="empty" style={{ padding: '3rem' }}>
                    <BarChart2 size={40} />
                    <p>No closed orders in this date range</p>
                  </div>
                </td></tr>
              ) : orders.map(o => (
                <>
                  <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => toggleExpand(o.id)}>
                    <td style={{ paddingRight: 0 }}>
                      {expanded === o.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="font-semibold">#{o.id}</td>
                    <td className="text-muted">{o.table_number ? `Table ${o.table_number}` : 'Takeaway'}</td>
                    <td className="text-sm text-muted">{o.closed_at ? new Date(o.closed_at).toLocaleString() : '—'}</td>
                    <td className="font-bold text-primary">{currency}{o.total.toFixed(2)}</td>
                  </tr>
                  {expanded === o.id && details[o.id] && (
                    <tr key={`${o.id}-detail`}>
                      <td colSpan={5} style={{ background: 'rgba(255,255,255,0.02)', padding: '0.5rem 1rem 1rem 2.5rem' }}>
                        <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', color: 'var(--text2)', padding: '0.3rem 0' }}>Item</th>
                              <th style={{ textAlign: 'center', color: 'var(--text2)', padding: '0.3rem 0' }}>Qty</th>
                              <th style={{ textAlign: 'right', color: 'var(--text2)', padding: '0.3rem 0' }}>Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {details[o.id].items.map(i => (
                              <tr key={i.id}>
                                <td style={{ padding: '0.2rem 0' }}>{i.item_name}</td>
                                <td style={{ textAlign: 'center' }}>{i.quantity}</td>
                                <td style={{ textAlign: 'right' }}>{currency}{i.subtotal.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
