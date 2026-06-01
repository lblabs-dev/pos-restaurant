import { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, Edit2, X } from 'lucide-react';
import { db } from '../lib/db';
import Modal from '../components/Modal';

export default function InvoicesPage({ showToast }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [orders, setOrders] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [details, setDetails] = useState({});
  const [editModal, setEditModal] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [editForm, setEditForm] = useState({ note: '', discount: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, [from, to]);

  const load = async () => {
    try {
      const data = await db.getOrdersHistory(from, to);
      setOrders(data);
    } catch (e) { showToast(e.toString(), 'error'); }
  };

  const toggleExpand = async (id) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!details[id]) {
      try {
        const d = await db.getOrderDetails(id);
        setDetails(prev => ({ ...prev, [id]: d }));
      } catch (e) { showToast(e.toString(), 'error'); }
    }
  };

  const openEdit = (order) => {
    setEditOrder(order);
    setEditForm({ note: order.note || '', discount: order.discount || 0 });
    setEditModal(true);
  };

  const handleEdit = async () => {
    setLoading(true);
    try {
      await db.adminEditOrder(editOrder.id, editForm.note || null, parseFloat(editForm.discount) || 0);
      showToast('Invoice updated');
      setEditModal(false);
      setDetails(prev => { const n = { ...prev }; delete n[editOrder.id]; return n; });
      load();
    } catch (e) { showToast(e.toString(), 'error'); }
    setLoading(false);
  };

  const fmt = (n) => Number(n || 0).toFixed(2);

  return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, flex: 1 }}>Invoices</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 140 }} />
          <label style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 140 }} />
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Table</th>
            <th>Cashier</th>
            <th>Date</th>
            <th>Discount</th>
            <th>Total</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <>
              <tr key={o.id} style={{ cursor: 'pointer' }}>
                <td onClick={() => toggleExpand(o.id)}>
                  {expanded === o.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {' '}#{o.id}
                </td>
                <td onClick={() => toggleExpand(o.id)}>Table {o.table_number ?? '—'}</td>
                <td onClick={() => toggleExpand(o.id)}>{o.user_name || '—'}</td>
                <td onClick={() => toggleExpand(o.id)}>{o.closed_at ? new Date(o.closed_at).toLocaleString() : '—'}</td>
                <td onClick={() => toggleExpand(o.id)} style={{ color: o.discount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {o.discount > 0 ? `-$${fmt(o.discount)}` : '—'}
                </td>
                <td onClick={() => toggleExpand(o.id)} style={{ fontWeight: 700, color: 'var(--success)' }}>
                  ${fmt(o.total)}
                </td>
                <td>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(o)} title="Edit"><Edit2 size={14} /></button>
                </td>
              </tr>
              {expanded === o.id && details[o.id] && (
                <tr key={`${o.id}-detail`}>
                  <td colSpan={7} style={{ background: 'var(--bg)', padding: '0.75rem 1rem' }}>
                    {o.note && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Note: {o.note}</p>}
                    <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', paddingBottom: '0.25rem', color: 'var(--text-muted)' }}>Item</th>
                          <th style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Qty</th>
                          <th style={{ textAlign: 'right', color: 'var(--text-muted)' }}>Price</th>
                          <th style={{ textAlign: 'right', color: 'var(--text-muted)' }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details[o.id].items.map(item => (
                          <tr key={item.id}>
                            <td style={{ padding: '0.2rem 0' }}>{item.item_name}</td>
                            <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                            <td style={{ textAlign: 'right' }}>${fmt(item.price)}</td>
                            <td style={{ textAlign: 'right' }}>${fmt(item.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </>
          ))}
          {orders.length === 0 && (
            <tr><td colSpan={7} className="empty">No invoices for this period</td></tr>
          )}
        </tbody>
      </table>

      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title={`Edit Invoice #${editOrder?.id}`}>
        <div className="form-group">
          <label>Discount ($)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={editForm.discount}
            onChange={e => setEditForm(f => ({ ...f, discount: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label>Note</label>
          <textarea
            value={editForm.note}
            onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
            rows={3}
            style={{ resize: 'vertical' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => setEditModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleEdit} disabled={loading}>
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
