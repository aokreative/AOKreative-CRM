import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { signOut } from '../services/auth.service';
import type { AuthUser } from '../services/auth.service';
import './DashboardLayout.css';

interface DashboardLayoutProps {
  user: AuthUser;
  children: React.ReactNode;
}

export default function DashboardLayout({ user, children }: DashboardLayoutProps) {
  const location = useLocation();
  const [aiOpen, setAiOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/';
  };

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/pipeline', label: 'Sales Pipeline', icon: '🔄' },
    { path: '/clients', label: 'Clients', icon: '👥' },
    { path: '/invoices', label: 'Invoices', icon: '💳' },
    { path: '/calendar', label: 'Calendar', icon: '📅' },
    { path: '/tasks', label: 'Tasks', icon: '✅' },
    { path: '/communications', label: 'Communications', icon: '💬' },
    { path: '/proposals', label: 'Proposals', icon: '📄' },
  ];

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>A&O Kreative CRM</h2>
          <p className="user-role">{user.profile.role}</p>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="ai-toggle" onClick={() => setAiOpen(!aiOpen)}>
            🤖 AI Assistant
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            🚪 Logout
          </button>
          <div className="user-info">
            <small>{user.profile.full_name || user.profile.email}</small>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>

      {/* AI Assistant Panel */}
      {aiOpen && (
        <aside className="ai-panel">
          <div className="ai-header">
            <h3>🤖 AI Assistant</h3>
            <button onClick={() => setAiOpen(false)}>✕</button>
          </div>
          <div className="ai-content">
            <div className="ai-message ai-system">
              <p>Hello! I can help you with CRM tasks. Ask me anything about your clients, leads, or invoices.</p>
            </div>
            <div className="ai-input-area">
              <input type="text" placeholder="Ask me something..." className="ai-input" />
              <button className="ai-send">Send</button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
