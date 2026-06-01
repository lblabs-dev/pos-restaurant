import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { db } from '../lib/db';

export default function SettingsPage({ onToast }) {
  const [form, setForm] = useState({
    restaurant_name: '',
    currency: '$',
    tax_rate: '0',
    receipt_footer: 'Thank you for dining with us!',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.getSettings().then(s => {
      setForm(prev => ({ ...prev, ...s }));
    }).catch(e => onToast(String(e), 'error'));
  }, [onToast]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(form).map(([k, v]) => db.setSetting(k, String(v)))
      );
      onToast('Settings saved!');
    } catch (err) { onToast(String(err), 'error'); }
    setSaving(false);
  }

  return (
    <>
      <div className="page-header">
        <h1>Settings</h1>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={14} style={{ marginRight: 6 }} />Save
        </button>
      </div>
      <div className="page-body">
        <div style={{ maxWidth: 520 }}>
          <form onSubmit={handleSave}>
            <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '1.25rem', fontSize: '0.95rem' }}>Restaurant Info</div>
              <div className="form-group">
                <label>Restaurant Name</label>
                <input type="text" value={form.restaurant_name}
                  onChange={e => setForm(f => ({ ...f, restaurant_name: e.target.value }))}
                  placeholder="My Restaurant" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Currency Symbol</label>
                  <input type="text" maxLength={4} value={form.currency}
                    onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                    placeholder="$" />
                </div>
                <div className="form-group">
                  <label>Tax Rate (%)</label>
                  <input type="number" min="0" max="100" step="0.1" value={form.tax_rate}
                    onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))}
                    placeholder="0" />
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '1.25rem', fontSize: '0.95rem' }}>Receipt</div>
              <div className="form-group">
                <label>Receipt Footer Message</label>
                <textarea rows={3} value={form.receipt_footer}
                  onChange={e => setForm(f => ({ ...f, receipt_footer: e.target.value }))}
                  placeholder="Thank you for dining with us!" style={{ resize: 'vertical' }} />
              </div>
            </div>

            <button className="btn btn-primary" type="submit" disabled={saving}>
              <Save size={14} style={{ marginRight: 6 }} />Save Settings
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
