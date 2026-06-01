import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, CheckCircle, XCircle, Minus, Plus, Trash2 } from 'lucide-react';
import { db } from '../lib/db';

const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function OrderPage({ onToast }) {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [activeCat, setActiveCat] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [detail, cats, menu, sett] = await Promise.all([
        db.getOrderDetails(Number(orderId)),
        db.getCategories(),
        db.getMenuItems(),
        db.getSettings(),
      ]);
      setOrder(detail.order);
      setItems(detail.items);
      setCategories(cats);
      setMenuItems(menu);
      setSettings(sett);
      if (!activeCat && cats.length > 0) setActiveCat('all');
    } catch (e) { onToast(String(e), 'error'); }
  }, [orderId, onToast]);

  useEffect(() => { load(); }, [load]);

  const currency = settings.currency || '$';
  const taxRate = parseFloat(settings.tax_rate || '0') / 100;
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  const visibleItems = menuItems.filter(m => {
    if (!m.available) return false;
    if (!activeCat || activeCat === 'all') return true;
    return m.category_id === activeCat;
  });

  async function addItem(menuItem) {
    try {
      await db.addOrderItem(Number(orderId), menuItem.id, 1);
      load();
    } catch (e) { onToast(String(e), 'error'); }
  }

  async function changeQty(item, delta) {
    const newQty = item.quantity + delta;
    try {
      if (newQty <= 0) {
        await db.removeOrderItem(item.id);
      } else {
        await db.updateOrderItemQuantity(item.id, newQty);
      }
      load();
    } catch (e) { onToast(String(e), 'error'); }
  }

  async function handleClose() {
    if (!items.length) { onToast('Add items before closing the order', 'error'); return; }
    if (!confirm('Close and pay this order?')) return;
    setLoading(true);
    try {
      await db.closeOrder(Number(orderId));
      onToast('Order closed successfully!');
      navigate('/');
    } catch (e) { onToast(String(e), 'error'); }
    setLoading(false);
  }

  async function handleCancel() {
    if (!confirm('Cancel this order? This cannot be undone.')) return;
    try {
      await db.cancelOrder(Number(orderId));
      onToast('Order cancelled');
      navigate('/');
    } catch (e) { onToast(String(e), 'error'); }
  }

  function handlePrint() {
    const restaurantName = settings.restaurant_name || 'Restaurant';
    const footer = settings.receipt_footer || 'Thank you!';
    const win = window.open('', '_blank', 'width=380,height=600');
    win.document.write(`
      <html><head><title>Receipt</title>
      <style>
        body{font-family:monospace;font-size:13px;padding:20px;max-width:300px;margin:0 auto}
        h2{text-align:center;margin:0 0 4px}
        .center{text-align:center} hr{border:1px dashed #333;margin:8px 0}
        .row{display:flex;justify-content:space-between}
        .bold{font-weight:bold}
      </style></head><body>
      <h2>${restaurantName}</h2>
      <p class="center">Order #${orderId}${order?.table_number ? ' · Table ' + order.table_number : ''}</p>
      <p class="center">${new Date().toLocaleString()}</p>
      <hr/>
      ${items.map(i => `<div class="row"><span>${i.quantity}x ${i.item_name}</span><span>${currency}${i.subtotal.toFixed(2)}</span></div>`).join('')}
      <hr/>
      ${taxRate > 0 ? `<div class="row"><span>Subtotal</span><span>${currency}${subtotal.toFixed(2)}</span></div>
      <div class="row"><span>Tax (${(taxRate * 100).toFixed(0)}%)</span><span>${currency}${tax.toFixed(2)}</span></div>` : ''}
      <div class="row bold"><span>TOTAL</span><span>${currency}${total.toFixed(2)}</span></div>
      <hr/>
      <p class="center">${footer}</p>
      </body></html>
    `);
    win.document.close();
    win.print();
  }

  if (!order) return <div className="page-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="text-muted">Loading...</span></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-2">
          <button className="btn-icon" onClick={() => navigate('/')}><ArrowLeft size={18} /></button>
          <h1>
            Order #{orderId}
            {order.table_number && <span className="text-muted text-sm" style={{ marginLeft: 8 }}>· Table {order.table_number}</span>}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost btn-sm" onClick={handlePrint}><Printer size={14} style={{ marginRight: 4 }} />Print</button>
          <button className="btn btn-danger btn-sm" onClick={handleCancel}><XCircle size={14} style={{ marginRight: 4 }} />Cancel</button>
          <button className="btn btn-success btn-sm" onClick={handleClose} disabled={loading}>
            <CheckCircle size={14} style={{ marginRight: 4 }} />Close & Pay
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="order-layout" style={{ flex: 1, overflow: 'hidden' }}>
        {/* Menu */}
        <div className="menu-panel">
          {/* Category tabs */}
          <div className="cat-tabs">
            <button
              className={`cat-tab${activeCat === 'all' ? ' active' : ''}`}
              style={activeCat === 'all' ? { background: '#f59e0b' } : {}}
              onClick={() => setActiveCat('all')}
            >All</button>
            {categories.map(c => (
              <button
                key={c.id}
                className={`cat-tab${activeCat === c.id ? ' active' : ''}`}
                style={activeCat === c.id ? { background: c.color } : { borderColor: c.color + '55' }}
                onClick={() => setActiveCat(c.id)}
              >{c.name}</button>
            ))}
          </div>
          {/* Items */}
          <div className="menu-items-grid">
            {visibleItems.map(m => (
              <button key={m.id} className="menu-item-btn" onClick={() => addItem(m)}>
                <span className="item-name">{m.name}</span>
                <span className="item-price">{currency}{m.price.toFixed(2)}</span>
                {m.category_name && <span className="text-xs text-muted">{m.category_name}</span>}
              </button>
            ))}
            {visibleItems.length === 0 && (
              <div className="text-muted text-sm" style={{ gridColumn: '1/-1', padding: '2rem', textAlign: 'center' }}>
                No items in this category
              </div>
            )}
          </div>
        </div>

        {/* Cart */}
        <div className="cart-panel">
          <div className="cart-header">
            <span className="font-semibold">Order Items</span>
            <span className="badge badge-ghost">{items.length} items</span>
          </div>
          <div className="cart-items">
            {items.length === 0 ? (
              <div className="empty" style={{ padding: '2rem' }}>
                <p className="text-sm">Tap items from the menu to add them here</p>
              </div>
            ) : items.map(item => (
              <div key={item.id} className="cart-item">
                <div style={{ flex: 1 }}>
                  <div className="cart-item-name">{item.item_name}</div>
                  <div className="cart-item-price">{currency}{item.price.toFixed(2)} each</div>
                </div>
                <div className="qty-ctrl">
                  <button onClick={() => changeQty(item, -1)}><Minus size={12} /></button>
                  <span>{item.quantity}</span>
                  <button onClick={() => changeQty(item, 1)}><Plus size={12} /></button>
                </div>
                <div style={{ minWidth: 60, textAlign: 'right', fontSize: '0.85rem', fontWeight: 600 }}>
                  {currency}{item.subtotal.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
          <div className="cart-footer">
            {taxRate > 0 && (
              <>
                <div className="flex justify-between text-sm text-muted">
                  <span>Subtotal</span><span>{currency}{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted">
                  <span>Tax ({(taxRate * 100).toFixed(0)}%)</span><span>{currency}{tax.toFixed(2)}</span>
                </div>
              </>
            )}
            <div className="cart-total">
              <span>Total</span>
              <span>{currency}{total.toFixed(2)}</span>
            </div>
            <button className="btn btn-success w-full" onClick={handleClose} disabled={loading || !items.length}>
              <CheckCircle size={16} style={{ marginRight: 6 }} />Close & Pay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
