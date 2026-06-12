import React, { useState } from 'react';
import { useInvoices } from '../hooks';
import { InvoiceService } from '../services/crm.service';
import jsPDF from 'jspdf';
import './Invoicing.css';

export default function Invoicing() {
  const { invoices, loading, error, refetch } = useInvoices();
  const [filter, setFilter] = useState('all');

  if (loading) return <div className="page-loading">Loading invoices…</div>;
  if (error) return <div className="page-error">{error}</div>;

  const filtered = invoices?.filter(inv => {
    if (filter === 'paid') return inv.status === 'paid';
    if (filter === 'overdue') return inv.status === 'overdue';
    if (filter === 'pending') return inv.status === 'pending';
    return true;
  }) || [];

  const handleExportPDF = (invoice: any) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('INVOICE', 20, 20);
    doc.setFontSize(12);
    doc.text(`Invoice #${invoice.invoice_number}`, 20, 35);
    doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, 20, 45);
    doc.text(`Due: ${new Date(invoice.due_date).toLocaleDateString()}`, 20, 55);
    doc.setFontSize(10);
    doc.text(`Amount: $${invoice.total_amount?.toFixed(2) || '0.00'}`, 20, 70);
    doc.text(`Status: ${invoice.status}`, 20, 80);
    doc.save(`invoice-${invoice.invoice_number}.pdf`);
  };

  const totalAmount = filtered.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const paidAmount = filtered.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Invoices</h1>
        <p>Track and manage client invoices</p>
      </div>

      <div className="invoice-summary">
        <div className="summary-card">
          <div className="summary-label">Total Outstanding</div>
          <div className="summary-value">${(totalAmount - paidAmount).toFixed(2)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total Revenue</div>
          <div className="summary-value">${totalAmount.toFixed(2)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Paid</div>
          <div className="summary-value">${paidAmount.toFixed(2)}</div>
        </div>
      </div>

      <div className="invoice-filters">
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Invoices
        </button>
        <button 
          className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Pending
        </button>
        <button 
          className={`filter-btn ${filter === 'paid' ? 'active' : ''}`}
          onClick={() => setFilter('paid')}
        >
          Paid
        </button>
        <button 
          className={`filter-btn ${filter === 'overdue' ? 'active' : ''}`}
          onClick={() => setFilter('overdue')}
        >
          Overdue
        </button>
      </div>

      <div className="invoice-table">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Client</th>
              <th>Amount</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(invoice => (
              <tr key={invoice.id}>
                <td><strong>#{invoice.invoice_number}</strong></td>
                <td>{invoice.client_id}</td>
                <td>${invoice.total_amount?.toFixed(2) || '0.00'}</td>
                <td>{new Date(invoice.due_date).toLocaleDateString()}</td>
                <td>
                  <span className={`status-badge status-${invoice.status}`}>
                    {invoice.status}
                  </span>
                </td>
                <td>
                  <button 
                    className="action-link"
                    onClick={() => handleExportPDF(invoice)}
                  >
                    📥 PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty-state">No invoices found</div>}
      </div>
    </div>
  );
}
