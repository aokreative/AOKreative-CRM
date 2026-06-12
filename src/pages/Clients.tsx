import React, { useState } from 'react';
import { useClients } from '../hooks';
import { ClientService } from '../services/crm.service';
import './Clients.css';

export default function Clients() {
  const { clients, loading, error, refetch } = useClients();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ company_name: '', contact_name: '', email: '', phone: '' });

  if (loading) return <div className="page-loading">Loading clients…</div>;
  if (error) return <div className="page-error">{error}</div>;

  const filtered = clients?.filter(c => 
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ClientService.create(formData);
      setFormData({ company_name: '', contact_name: '', email: '', phone: '' });
      setShowForm(false);
      refetch();
    } catch (err) {
      console.error('Failed to create client:', err);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Clients</h1>
        <p>Manage client information and projects</p>
      </div>

      <div className="clients-toolbar">
        <input
          type="text"
          placeholder="Search clients…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
        />
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          + New Client
        </button>
      </div>

      {showForm && (
        <div className="form-card">
          <h3>Add New Client</h3>
          <form onSubmit={handleAddClient}>
            <div className="form-row">
              <div className="form-group">
                <label>Company Name</label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={e => setFormData({...formData, company_name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Contact Name</label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={e => setFormData({...formData, contact_name: e.target.value})}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit">Save Client</button>
              <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="clients-table">
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Added</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(client => (
              <tr key={client.id}>
                <td><strong>{client.company_name}</strong></td>
                <td>{client.contact_name}</td>
                <td>{client.email}</td>
                <td>{client.phone || '—'}</td>
                <td>{new Date(client.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty-state">No clients found</div>}
      </div>
    </div>
  );
}
