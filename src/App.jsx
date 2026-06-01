import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { LayoutGrid, BookOpen, BarChart2, Settings, UtensilsCrossed, Users, Printer, FileText, LogOut } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import TablesPage from './pages/TablesPage';
import OrderPage from './pages/OrderPage';
import MenuPage from './pages/MenuPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import UsersPage from './pages/UsersPage';
import PrintersPage from './pages/PrintersPage';
import InvoicesPage from './pages/InvoicesPage';
import Toast from './components/Toast';
import './App.css';

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="sidebar-clock-wrap">
      <div className="sidebar-clock">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
        {time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
      </div>
    </div>
  );
}

function ProtectedLayout({ showToast }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isOrderPage = location.pathname.startsWith('/order/');

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="layout">
      {!isOrderPage && (
        <aside className="sidebar">
          <div className="sidebar-logo">
            <UtensilsCrossed size={22} />
            <span>POS System</span>
          </div>
          <nav className="sidebar-nav">
            <NavLink to="/" end>
              <LayoutGrid size={18} />Tables
            </NavLink>
            <NavLink to="/menu">
              <BookOpen size={18} />Menu
            </NavLink>
            <NavLink to="/reports">
              <BarChart2 size={18} />Reports
            </NavLink>
            <NavLink to="/settings">
              <Settings size={18} />Settings
            </NavLink>
            {user.role === 'admin' && (
              <>
                <div style={{ height: 1, background: 'var(--border)', margin: '0.5rem 0.75rem' }} />
                <NavLink to="/users">
                  <Users size={18} />Users
                </NavLink>
                <NavLink to="/printers">
                  <Printer size={18} />Printers
                </NavLink>
                <NavLink to="/invoices">
                  <FileText size={18} />Invoices
                </NavLink>
              </>
            )}
          </nav>
          <div className="sidebar-bottom">
            <Clock />
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                {user.full_name || user.username}
                {' '}<span style={{ fontSize: '0.7rem', opacity: 0.6 }}>({user.role})</span>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={logout}
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          </div>
        </aside>
      )}

      <div className="main-content">
        <Routes>
          <Route path="/" element={<TablesPage onToast={showToast} />} />
          <Route path="/order/:orderId" element={<OrderPage onToast={showToast} />} />
          <Route path="/menu" element={<MenuPage onToast={showToast} />} />
          <Route path="/reports" element={<ReportsPage onToast={showToast} />} />
          <Route path="/settings" element={<SettingsPage onToast={showToast} />} />
          <Route path="/users" element={user.role === 'admin' ? <UsersPage showToast={showToast} /> : <Navigate to="/" />} />
          <Route path="/printers" element={user.role === 'admin' ? <PrintersPage showToast={showToast} /> : <Navigate to="/" />} />
          <Route path="/invoices" element={user.role === 'admin' ? <InvoicesPage showToast={showToast} /> : <Navigate to="/" />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message: String(message), type });
  }, []);

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<ProtectedLayout showToast={showToast} />} />
      </Routes>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}

