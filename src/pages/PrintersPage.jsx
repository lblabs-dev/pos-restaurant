import { useState, useEffect } from 'react';
import { Printer, Save } from 'lucide-react';
import { db } from '../lib/db';

export default function PrintersPage({ showToast }) {
  const [printers, setPrinters] = useState([]);
  const [settings, setSettings] = useState({});
  const [kitchenPrinter, setKitchenPrinter] = useState('');
  const [receiptPrinter, setReceiptPrinter] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPrinters();
    loadSettings();
  }, []);

  const loadPrinters = async () => {
    try {
      const list = await db.getPrinters();
      setPrinters(list);
    } catch (e) {
      showToast('Could not load printers: ' + e.toString(), 'error');
    }
  };

  const loadSettings = async () => {
    try {
      const s = await db.getSettings();
      const map = {};
      s.forEach(({ key, value }) => { map[key] = value; });
      setSettings(map);
      setKitchenPrinter(map.kitchen_printer || '');
      setReceiptPrinter(map.receipt_printer || '');
    } catch (e) {
      showToast(e.toString(), 'error');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await db.setSetting('kitchen_printer', kitchenPrinter);
      await db.setSetting('receipt_printer', receiptPrinter);
      showToast('Printer settings saved');
    } catch (e) {
      showToast(e.toString(), 'error');
    }
    setLoading(false);
  };

  const testKitchen = async () => {
    if (!kitchenPrinter) return showToast('Select a kitchen printer first', 'error');
    try {
      await db.printKitchenTicket(kitchenPrinter, '=== KITCHEN TEST ===\nThis is a test ticket.\n====================\n');
      showToast('Test sent to kitchen printer');
    } catch (e) {
      showToast(e.toString(), 'error');
    }
  };

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Printer Settings</h2>
        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
          <Save size={16} /> {loading ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Printer size={18} /> Kitchen Printer
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Used to print order tickets sent to the kitchen.
          </p>
          <div className="form-group">
            <label>Printer</label>
            <select value={kitchenPrinter} onChange={e => setKitchenPrinter(e.target.value)}>
              <option value="">— None —</option>
              {printers.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={testKitchen} style={{ marginTop: '0.5rem' }}>
            Send Test Print
          </button>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Printer size={18} /> Receipt Printer
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Used when printing customer receipts (opens browser print dialog).
          </p>
          <div className="form-group">
            <label>Printer</label>
            <select value={receiptPrinter} onChange={e => setReceiptPrinter(e.target.value)}>
              <option value="">— None / Default —</option>
              {printers.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
          <h4 style={{ marginTop: 0 }}>Available Printers ({printers.length})</h4>
          {printers.length === 0
            ? <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No printers detected.</p>
            : <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {printers.map(p => <li key={p}>{p}</li>)}
            </ul>
          }
          <button className="btn btn-ghost btn-sm" onClick={loadPrinters} style={{ marginTop: '0.75rem' }}>
            Refresh List
          </button>
        </div>
      </div>
    </div>
  );
}
