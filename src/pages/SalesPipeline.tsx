import React, { useState } from 'react';
import { useLeads } from '../hooks';
import { LeadService } from '../services/crm.service';
import type { Lead } from '../types/database';
import './SalesPipeline.css';

const PIPELINE_STAGES = ['New', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];

export default function SalesPipeline() {
  const { leads, loading, error, refetch } = useLeads();
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);

  if (loading) return <div className="page-loading">Loading pipeline…</div>;
  if (error) return <div className="page-error">{error}</div>;

  const handleDragStart = (lead: Lead) => {
    setDraggedLead(lead);
  };

  const handleDrop = async (stage: string) => {
    if (!draggedLead) return;
    try {
      await LeadService.update(draggedLead.id, { status: stage });
      refetch();
    } catch (err) {
      console.error('Failed to update lead status:', err);
    }
    setDraggedLead(null);
  };

  const getLeadsByStage = (stage: string) => {
    return leads?.filter(lead => lead.status === stage) || [];
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Sales Pipeline</h1>
        <p>Drag leads to move them through stages</p>
      </div>

      <div className="pipeline">
        {PIPELINE_STAGES.map(stage => (
          <div
            key={stage}
            className="pipeline-column"
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(stage)}
          >
            <h3 className="column-title">
              {stage}
              <span className="column-count">{getLeadsByStage(stage).length}</span>
            </h3>

            <div className="column-cards">
              {getLeadsByStage(stage).map(lead => (
                <div
                  key={lead.id}
                  className="lead-card"
                  draggable
                  onDragStart={() => handleDragStart(lead)}
                >
                  <h4>{lead.company_name}</h4>
                  <p className="contact">{lead.contact_name}</p>
                  <p className="email">{lead.email}</p>
                  <div className="lead-footer">
                    <span className="value">{lead.estimated_value ? `$${lead.estimated_value.toFixed(2)}` : '$0'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
