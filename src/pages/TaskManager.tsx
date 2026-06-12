import React, { useState } from 'react';
import { useTasks } from '../hooks';
import { TaskService } from '../services/crm.service';
import type { Task } from '../types/database';
import './TaskManager.css';

export default function TaskManager() {
  const { tasks, loading, error, refetch } = useTasks();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', due_date: '', assigned_to: '' });

  if (loading) return <div className="page-loading">Loading tasks…</div>;
  if (error) return <div className="page-error">{error}</div>;

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await TaskService.create(formData);
      setFormData({ title: '', description: '', due_date: '', assigned_to: '' });
      setShowForm(false);
      refetch();
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleToggleComplete = async (task: Task) => {
    try {
      await TaskService.update(task.id, { status: task.status === 'completed' ? 'pending' : 'completed' });
      refetch();
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const sortedTasks = [...(tasks || [])].sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    return new Date(a.due_date || '').getTime() - new Date(b.due_date || '').getTime();
  });

  const pendingCount = tasks?.filter(t => t.status !== 'completed').length || 0;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Tasks</h1>
        <p>{pendingCount} pending tasks</p>
      </div>

      <div className="task-toolbar">
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          + New Task
        </button>
      </div>

      {showForm && (
        <div className="form-card">
          <h3>Create New Task</h3>
          <form onSubmit={handleAddTask}>
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                placeholder="Task title"
                required
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Task details"
                rows={3}
              ></textarea>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Due Date</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={e => setFormData({...formData, due_date: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Assigned To</label>
                <input
                  type="text"
                  value={formData.assigned_to}
                  onChange={e => setFormData({...formData, assigned_to: e.target.value})}
                  placeholder="Team member"
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit">Create Task</button>
              <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="task-list">
        {sortedTasks.map(task => (
          <div key={task.id} className={`task-item ${task.status === 'completed' ? 'completed' : ''}`}>
            <div className="task-checkbox">
              <input
                type="checkbox"
                checked={task.status === 'completed'}
                onChange={() => handleToggleComplete(task)}
              />
            </div>
            <div className="task-content">
              <h4>{task.title}</h4>
              {task.description && <p>{task.description}</p>}
              <div className="task-meta">
                {task.due_date && <span className="due-date">📅 {new Date(task.due_date).toLocaleDateString()}</span>}
                {task.assigned_to && <span className="assigned">👤 {task.assigned_to}</span>}
              </div>
            </div>
            <div className="task-status">
              <span className={`status-label status-${task.status}`}>{task.status}</span>
            </div>
          </div>
        ))}
        {sortedTasks.length === 0 && <div className="empty-state">No tasks. Great job!</div>}
      </div>
    </div>
  );
}
