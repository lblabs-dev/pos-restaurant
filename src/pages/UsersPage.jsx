import { useState, useEffect } from 'react';
import { UserPlus, Edit2, Trash2, Key, Shield, User } from 'lucide-react';
import { db } from '../lib/db';
import Modal from '../components/Modal';

export default function UsersPage({ showToast }) {
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null); // 'add' | 'edit' | 'password' | 'delete'
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', role: 'cashier', fullName: '' });
  const [pwForm, setPwForm] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { setUsers(await db.getUsers()); } catch (e) { showToast(e.toString(), 'error'); }
  };

  const openAdd = () => {
    setForm({ username: '', password: '', role: 'cashier', fullName: '' });
    setSelected(null);
    setModal('add');
  };

  const openEdit = (u) => {
    setForm({ username: u.username, password: '', role: u.role, fullName: u.full_name || '' });
    setSelected(u);
    setModal('edit');
  };

  const openPassword = (u) => {
    setPwForm({ password: '', confirm: '' });
    setSelected(u);
    setModal('password');
  };

  const openDelete = (u) => { setSelected(u); setModal('delete'); };
  const closeModal = () => { setModal(null); setSelected(null); };

  const handleAdd = async () => {
    if (!form.username.trim() || !form.password) return showToast('Username and password required', 'error');
    setLoading(true);
    try {
      await db.addUser(form.username.trim(), form.password, form.role, form.fullName || null);
      showToast('User created');
      closeModal();
      load();
    } catch (e) { showToast(e.toString(), 'error'); }
    setLoading(false);
  };

  const handleEdit = async () => {
    if (!form.username.trim()) return showToast('Username required', 'error');
    setLoading(true);
    try {
      await db.updateUser(selected.id, form.username.trim(), form.role, form.fullName || null, form.active !== false);
      showToast('User updated');
      closeModal();
      load();
    } catch (e) { showToast(e.toString(), 'error'); }
    setLoading(false);
  };

  const handleToggleActive = async (u) => {
    try {
      await db.updateUser(u.id, u.username, u.role, u.full_name, !u.active);
      showToast(u.active ? 'User disabled' : 'User enabled');
      load();
    } catch (e) { showToast(e.toString(), 'error'); }
  };

  const handlePassword = async () => {
    if (!pwForm.password) return showToast('Password required', 'error');
    if (pwForm.password !== pwForm.confirm) return showToast('Passwords do not match', 'error');
    setLoading(true);
    try {
      await db.changePassword(selected.id, pwForm.password);
      showToast('Password changed');
      closeModal();
    } catch (e) { showToast(e.toString(), 'error'); }
    setLoading(false);
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await db.deleteUser(selected.id);
      showToast('User deleted');
      closeModal();
      load();
    } catch (e) { showToast(e.toString(), 'error'); }
    setLoading(false);
  };

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Users</h2>
        <button className="btn btn-primary" onClick={openAdd}>
          <UserPlus size={16} /> Add User
        </button>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Full Name</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td style={{ fontWeight: 600 }}>{u.username}</td>
              <td>{u.full_name || '—'}</td>
              <td>
                <span className={`badge-${u.role === 'admin' ? 'warning' : 'info'}`}>
                  {u.role === 'admin' ? <Shield size={12} /> : <User size={12} />}
                  {' '}{u.role}
                </span>
              </td>
              <td>
                <span className={u.active ? 'badge-success' : 'badge-danger'}>
                  {u.active ? 'Active' : 'Disabled'}
                </span>
              </td>
              <td>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(u)} title="Edit"><Edit2 size={14} /></button>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openPassword(u)} title="Change password"><Key size={14} /></button>
                  <button
                    className={`btn btn-sm ${u.active ? 'btn-danger' : 'btn-success'}`}
                    onClick={() => handleToggleActive(u)}
                    style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                  >
                    {u.active ? 'Disable' : 'Enable'}
                  </button>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => openDelete(u)} title="Delete"><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr><td colSpan={5} className="empty">No users found</td></tr>
          )}
        </tbody>
      </table>

      {/* Add Modal */}
      <Modal isOpen={modal === 'add'} onClose={closeModal} title="Add User">
        <div className="form-group">
          <label>Username *</label>
          <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Full Name</label>
          <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Password *</label>
          <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Role</label>
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            <option value="cashier">Cashier</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAdd} disabled={loading}>
            {loading ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={modal === 'edit'} onClose={closeModal} title="Edit User">
        <div className="form-group">
          <label>Username *</label>
          <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Full Name</label>
          <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Role</label>
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            <option value="cashier">Cashier</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
          <button className="btn btn-primary" onClick={handleEdit} disabled={loading}>
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal isOpen={modal === 'password'} onClose={closeModal} title={`Change Password — ${selected?.username}`}>
        <div className="form-group">
          <label>New Password *</label>
          <input type="password" value={pwForm.password} onChange={e => setPwForm(f => ({ ...f, password: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Confirm Password *</label>
          <input type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
          <button className="btn btn-primary" onClick={handlePassword} disabled={loading}>
            {loading ? 'Saving…' : 'Change Password'}
          </button>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={modal === 'delete'} onClose={closeModal} title="Delete User">
        <p>Delete user <strong>{selected?.username}</strong>? This cannot be undone.</p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={loading}>
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
