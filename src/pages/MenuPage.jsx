import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, Tag } from 'lucide-react';
import { db } from '../lib/db';
import Modal from '../components/Modal';

const PALETTE = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'];

export default function MenuPage({ onToast }) {
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('items'); // 'items' | 'categories'

  // Category form
  const [showCatModal, setShowCatModal] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [catForm, setCatForm] = useState({ name: '', color: PALETTE[0] });

  // Menu item form
  const [showItemModal, setShowItemModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [itemForm, setItemForm] = useState({ category_id: '', name: '', price: '', description: '', available: true });

  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cats, items] = await Promise.all([db.getCategories(), db.getMenuItems()]);
      setCategories(cats);
      setMenuItems(items);
    } catch (e) { onToast(String(e), 'error'); }
  }, [onToast]);

  useEffect(() => { load(); }, [load]);

  // ---- Categories ----
  function openAddCat() { setEditCat(null); setCatForm({ name: '', color: PALETTE[0] }); setShowCatModal(true); }
  function openEditCat(c) { setEditCat(c); setCatForm({ name: c.name, color: c.color }); setShowCatModal(true); }

  async function saveCat(e) {
    e.preventDefault(); setSaving(true);
    try {
      if (editCat) await db.updateCategory(editCat.id, catForm.name, catForm.color);
      else await db.addCategory(catForm.name, catForm.color);
      onToast(editCat ? 'Category updated' : 'Category added');
      setShowCatModal(false); load();
    } catch (err) { onToast(String(err), 'error'); }
    setSaving(false);
  }

  async function deleteCat(c) {
    if (!confirm(`Delete category "${c.name}"? Menu items in this category will become uncategorized.`)) return;
    try { await db.deleteCategory(c.id); onToast('Category deleted'); load(); }
    catch (err) { onToast(String(err), 'error'); }
  }

  // ---- Menu items ----
  function openAddItem() {
    setEditItem(null);
    setItemForm({ category_id: categories[0]?.id || '', name: '', price: '', description: '', available: true });
    setShowItemModal(true);
  }

  function openEditItem(m) {
    setEditItem(m);
    setItemForm({ category_id: m.category_id || '', name: m.name, price: String(m.price), description: m.description || '', available: m.available });
    setShowItemModal(true);
  }

  async function saveItem(e) {
    e.preventDefault(); setSaving(true);
    try {
      const catId = itemForm.category_id ? Number(itemForm.category_id) : null;
      if (editItem) {
        await db.updateMenuItem(editItem.id, catId, itemForm.name, Number(itemForm.price), itemForm.description || null, itemForm.available);
        onToast('Item updated');
      } else {
        await db.addMenuItem(catId, itemForm.name, Number(itemForm.price), itemForm.description || null);
        onToast('Item added');
      }
      setShowItemModal(false); load();
    } catch (err) { onToast(String(err), 'error'); }
    setSaving(false);
  }

  async function deleteItem(m) {
    if (!confirm(`Delete "${m.name}"?`)) return;
    try { await db.deleteMenuItem(m.id); onToast('Item deleted'); load(); }
    catch (err) { onToast(String(err), 'error'); }
  }

  const filtered = menuItems.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.category_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <h1>Menu</h1>
        <div className="flex items-center gap-1">
          <div className="search-wrap">
            <Search size={14} />
            <input className="search-input" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: 3, gap: 2 }}>
            <button className={`btn btn-sm${tab === 'items' ? ' btn-primary' : ' btn-ghost'}`} style={{ border: 'none' }} onClick={() => setTab('items')}>Items</button>
            <button className={`btn btn-sm${tab === 'categories' ? ' btn-primary' : ' btn-ghost'}`} style={{ border: 'none' }} onClick={() => setTab('categories')}>Categories</button>
          </div>
          {tab === 'items'
            ? <button className="btn btn-primary btn-sm" onClick={openAddItem}><Plus size={14} style={{ marginRight: 4 }} />Add Item</button>
            : <button className="btn btn-primary btn-sm" onClick={openAddCat}><Plus size={14} style={{ marginRight: 4 }} />Add Category</button>
          }
        </div>
      </div>

      <div className="page-body">
        {tab === 'categories' ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead><tr><th>Color</th><th>Name</th><th>Items</th><th>Actions</th></tr></thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr><td colSpan={4}><div className="empty" style={{ padding: '2rem' }}><Tag size={32} /><p>No categories yet</p></div></td></tr>
                ) : categories.map(c => (
                  <tr key={c.id}>
                    <td><span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: '50%', background: c.color }} /></td>
                    <td className="font-semibold">{c.name}</td>
                    <td className="text-muted">{menuItems.filter(m => m.category_id === c.id).length}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn-icon" onClick={() => openEditCat(c)}><Pencil size={14} /></button>
                        <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => deleteCat(c)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5}><div className="empty" style={{ padding: '2rem' }}><p>{search ? 'No results' : 'No menu items yet'}</p></div></td></tr>
                ) : filtered.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div className="font-semibold">{m.name}</div>
                      {m.description && <div className="text-xs text-muted">{m.description}</div>}
                    </td>
                    <td>
                      {m.category_name ? (
                        <span className="badge" style={{ background: (categories.find(c => c.id === m.category_id)?.color || '#64748b') + '22', color: categories.find(c => c.id === m.category_id)?.color || '#94a3b8' }}>
                          {m.category_name}
                        </span>
                      ) : <span className="text-muted text-xs">—</span>}
                    </td>
                    <td className="font-bold text-primary">{m.price.toFixed(2)}</td>
                    <td>
                      <span className={`badge ${m.available ? 'badge-success' : 'badge-danger'}`}>
                        {m.available ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn-icon" onClick={() => openEditItem(m)}><Pencil size={14} /></button>
                        <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => deleteItem(m)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Category Modal */}
      {showCatModal && (
        <Modal title={editCat ? 'Edit Category' : 'Add Category'} onClose={() => setShowCatModal(false)}
          actions={<><button className="btn btn-ghost" onClick={() => setShowCatModal(false)}>Cancel</button><button className="btn btn-primary" onClick={saveCat} disabled={saving}>Save</button></>}>
          <form onSubmit={saveCat}>
            <div className="form-group">
              <label>Name</label>
              <input type="text" required value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Starters, Drinks…" />
            </div>
            <div className="form-group">
              <label>Color</label>
              <div className="color-swatch">
                {PALETTE.map(c => (
                  <button key={c} type="button" style={{ background: c }} className={catForm.color === c ? 'selected' : ''}
                    onClick={() => setCatForm(f => ({ ...f, color: c }))} />
                ))}
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <Modal title={editItem ? 'Edit Item' : 'Add Menu Item'} onClose={() => setShowItemModal(false)}
          actions={<><button className="btn btn-ghost" onClick={() => setShowItemModal(false)}>Cancel</button><button className="btn btn-primary" onClick={saveItem} disabled={saving}>Save</button></>}>
          <form onSubmit={saveItem}>
            <div className="form-group">
              <label>Name</label>
              <input type="text" required value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} placeholder="Item name" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Price</label>
                <input type="number" required min="0" step="0.01" value={itemForm.price}
                  onChange={e => setItemForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={itemForm.category_id} onChange={e => setItemForm(f => ({ ...f, category_id: e.target.value }))}>
                  <option value="">— None —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Description (optional)</label>
              <textarea rows={2} value={itemForm.description}
                onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description…" style={{ resize: 'vertical' }} />
            </div>
            {editItem && (
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
                <input type="checkbox" id="available" checked={itemForm.available}
                  onChange={e => setItemForm(f => ({ ...f, available: e.target.checked }))}
                  style={{ width: 'auto', accentColor: 'var(--primary)' }} />
                <label htmlFor="available" style={{ margin: 0 }}>Available for ordering</label>
              </div>
            )}
          </form>
        </Modal>
      )}
    </>
  );
}
