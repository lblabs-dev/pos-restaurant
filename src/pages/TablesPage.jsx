import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Pencil, Trash2 } from 'lucide-react';
import { db } from '../lib/db';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import Toast from '../components/Toast';

export default function TablesPage({ onToast }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ number: '', name: '', capacity: '4' });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setTables(await db.getTables());
    } catch (e) { onToast(e, 'error'); }
  }, [onToast]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm({ number: '', name: '', capacity: '4' });
    setShowModal(true);
  }

  function openEdit(e, t) {
    e.stopPropagation();
    setEditing(t);
    setForm({ number: String(t.number), name: t.name || '', capacity: String(t.capacity) });
    setShowModal(true);
  }

  async function handleDelete(e, t) {
    e.stopPropagation();
    if (!confirm(`Delete table ${t.number}?`)) return;
    try {
      await db.deleteTable(t.id);
      onToast('Table deleted');
      load();
    } catch (err) { onToast(err, 'error'); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (editing) {
        await db.updateTable(editing.id, Number(form.number), form.name || null, Number(form.capacity));
        onToast('Table updated');
      } else {
        await db.addTable(Number(form.number), form.name || null, Number(form.capacity));
        onToast('Table added');
      }
      setShowModal(false);
      load();
    } catch (err) { onToast(String(err), 'error'); }
    setLoading(false);
  }

  async function handleTableClick(t) {
    if (t.status === 'occupied' && t.current_order_id) {
      navigate(`/order/${t.current_order_id}`);
    } else {
      try {
        const orderId = await db.createOrder(t.id, user?.id ?? null);
        navigate(`/order/${orderId}`);
      } catch (err) { onToast(String(err), 'error'); }
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Tables</h1>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} style={{ marginRight: 6 }} />Add Table
        </button>
      </div>
      <div className="page-body">
        {tables.length === 0 ? (
          <div className="empty">
            <Users size={48} />
            <p>No tables yet. Add a table to get started.</p>
          </div>
        ) : (
          <div className="table-grid">
            {tables.map(t => (
              <div
                key={t.id}
                className={`table-card ${t.status}`}
                onClick={() => handleTableClick(t)}
              >
                <div className="t-number">#{t.number}</div>
                {t.name && <div className="t-name">{t.name}</div>}
                <div className={`t-status ${t.status}`}>{t.status}</div>
                <div className="t-capacity">
                  <Users size={12} />
                  {t.capacity} seats
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }} onClick={e => e.stopPropagation()}>
                  <button className="btn-icon" onClick={e => openEdit(e, t)} title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={e => handleDelete(e, t)} title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <Modal
          title={editing ? 'Edit Table' : 'Add Table'}
          onClose={() => setShowModal(false)}
          actions={
            <>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                {editing ? 'Save' : 'Add'}
              </button>
            </>
          }
        >
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Table Number</label>
                <input type="number" required min="1" value={form.number}
                  onChange={e => setForm(f => ({ ...f, number: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Capacity</label>
                <input type="number" required min="1" value={form.capacity}
                  onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Name / Label (optional)</label>
              <input type="text" placeholder="e.g. Window, VIP, Terrace"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
