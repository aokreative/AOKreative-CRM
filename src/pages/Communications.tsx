import React from 'react';
import { useAsync } from '../hooks';
import { ActivityService } from '../services/activity.service';
import './Communications.css';

export default function Communications() {
  const { data: activities, loading, error } = useAsync(() => ActivityService.getActivityLog(), []);

  if (loading) return <div className="page-loading">Loading communications…</div>;
  if (error) return <div className="page-error">{error}</div>;

  const grouped = activities?.reduce((acc: any, act: any) => {
    const date = new Date(act.created_at).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(act);
    return acc;
  }, {}) || {};

  const activityTypeIcon: Record<string, string> = {
    email: '📧',
    call: '☎️',
    meeting: '👥',
    note: '📝',
    invoice: '💳',
    proposal: '📄',
    'default': '💬'
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Communications</h1>
        <p>Activity log and client interactions</p>
      </div>

      <div className="communications-container">
        <div className="timeline">
          {Object.entries(grouped)
            .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
            .map(([date, acts]: any) => (
              <div key={date} className="timeline-group">
                <div className="timeline-date">{date}</div>
                <div className="timeline-events">
                  {acts.map((activity: any) => (
                    <div key={activity.id} className="timeline-event">
                      <div className="event-icon">
                        {activityTypeIcon[activity.activity_type] || activityTypeIcon.default}
                      </div>
                      <div className="event-content">
                        <h4>{activity.description}</h4>
                        <p className="event-details">
                          <span className="activity-type">{activity.activity_type}</span>
                        </p>
                        {activity.notes && <p className="event-notes">{activity.notes}</p>}
                        <small className="event-time">
                          {new Date(activity.created_at).toLocaleTimeString()}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>

        {activities?.length === 0 && <div className="empty-state">No communications yet</div>}
      </div>
    </div>
  );
}
