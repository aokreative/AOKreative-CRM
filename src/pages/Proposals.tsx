import React, { useState } from 'react';
import './Proposals.css';

interface Proposal {
  id: string;
  client_name: string;
  title: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  amount: number;
  created_date: string;
  expiry_date: string;
}

export default function Proposals() {
  // Mock data - will be replaced with useAsync hook for real API
  const [proposals] = useState<Proposal[]>([
    {
      id: '1',
      client_name: 'Acme Corp',
      title: 'Website Redesign Project',
      status: 'sent',
      amount: 15000,
      created_date: '2024-01-15',
      expiry_date: '2024-02-15'
    },
    {
      id: '2',
      client_name: 'Tech Startup Inc',
      title: 'Mobile App Development',
      status: 'accepted',
      amount: 45000,
      created_date: '2024-01-20',
      expiry_date: '2024-02-20'
    }
  ]);

  const [showForm, setShowForm] = useState(false);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: '#999',
      sent: '#667eea',
      accepted: '#2e7d32',
      rejected: '#c62828'
    };
    return colors[status] || '#999';
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Proposals</h1>
        <p>Manage project proposals and documents</p>
      </div>

      <div className="proposals-toolbar">
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          + New Proposal
        </button>
      </div>

      {showForm && (
        <div className="form-card">
          <h3>Create New Proposal</h3>
          <form onSubmit={e => { e.preventDefault(); setShowForm(false); }}>
            <div className="form-group">
              <label>Client Name</label>
              <input type="text" placeholder="Client company name" required />
            </div>
            <div className="form-group">
              <label>Proposal Title</label>
              <input type="text" placeholder="e.g., Website Redesign" required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Amount</label>
                <input type="number" placeholder="0.00" required />
              </div>
              <div className="form-group">
                <label>Expiry Date</label>
                <input type="date" required />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea placeholder="Proposal details" rows={4}></textarea>
            </div>
            <div className="form-actions">
              <button type="submit">Create Proposal</button>
              <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="proposals-grid">
        {proposals.map(proposal => (
          <div key={proposal.id} className="proposal-card">
            <div className="proposal-header">
              <h3>{proposal.title}</h3>
              <span
                className="status-badge"
                style={{ background: getStatusColor(proposal.status) + '20', color: getStatusColor(proposal.status) }}
              >
                {proposal.status}
              </span>
            </div>
            <div className="proposal-body">
              <p className="client-name">{proposal.client_name}</p>
              <div className="proposal-amount">${proposal.amount.toLocaleString()}</div>
              <div className="proposal-dates">
                <small>Created: {new Date(proposal.created_date).toLocaleDateString()}</small>
                <small>Expires: {new Date(proposal.expiry_date).toLocaleDateString()}</small>
              </div>
            </div>
            <div className="proposal-actions">
              <button className="action-link">View</button>
              <button className="action-link">Edit</button>
              <button className="action-link">Send</button>
            </div>
          </div>
        ))}
      </div>

      {proposals.length === 0 && <div className="empty-state">No proposals yet</div>}
    </div>
  );
}
