import React from 'react';
import { useDashboard } from '../hooks';
import './Dashboard.css';

export default function Dashboard() {
  const { stats, loading, error } = useDashboard();

  if (loading) return <div className="page-loading">Loading…</div>;
  if (error) return <div className="page-error">{error}</div>;

  return (
    <div className="page dashboard-page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Overview of your CRM metrics</p>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">👥</div>
          <div className="metric-content">
            <div className="metric-label">Total Clients</div>
            <div className="metric-value">{stats?.totalClients || 0}</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🎯</div>
          <div className="metric-content">
            <div className="metric-label">Active Leads</div>
            <div className="metric-value">{stats?.activeLeads || 0}</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">💳</div>
          <div className="metric-content">
            <div className="metric-label">Outstanding Invoices</div>
            <div className="metric-value">${stats?.outstandingAmount?.toFixed(2) || '0.00'}</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">✅</div>
          <div className="metric-content">
            <div className="metric-label">Tasks Due Today</div>
            <div className="metric-value">{stats?.tasksDueToday || 0}</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📊</div>
          <div className="metric-content">
            <div className="metric-label">Total Revenue</div>
            <div className="metric-value">${stats?.totalRevenue?.toFixed(2) || '0.00'}</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🔄</div>
          <div className="metric-content">
            <div className="metric-label">Conversion Rate</div>
            <div className="metric-value">{stats?.conversionRate?.toFixed(1) || '0'}%</div>
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        <section className="dashboard-section">
          <h2>Recent Activity</h2>
          <div className="activity-list">
            <div className="activity-item">
              <span className="activity-icon">📝</span>
              <span className="activity-text">No recent activities</span>
            </div>
          </div>
        </section>

        <section className="dashboard-section">
          <h2>Quick Actions</h2>
          <div className="quick-actions">
            <button className="action-btn">+ New Client</button>
            <button className="action-btn">+ New Lead</button>
            <button className="action-btn">+ New Invoice</button>
            <button className="action-btn">+ New Task</button>
          </div>
        </section>
      </div>
    </div>
  );
}
