import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/DashboardLayout';
import Dashboard from './pages/Dashboard';
import SalesPipeline from './pages/SalesPipeline';
import Clients from './pages/Clients';
import Invoicing from './pages/Invoicing';
import Calendar from './pages/Calendar';
import TaskManager from './pages/TaskManager';
import Communications from './pages/Communications';
import Proposals from './pages/Proposals';
import './App.css';

export default function App() {
  const { authUser, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div>Loading…</div>
      </div>
    );
  }

  if (!authUser) {
    return <LoginPage />;
  }

  return (
    <BrowserRouter>
      <DashboardLayout user={authUser}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pipeline" element={<SalesPipeline />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/invoices" element={<Invoicing />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/tasks" element={<TaskManager />} />
          <Route path="/communications" element={<Communications />} />
          <Route path="/proposals" element={<Proposals />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </DashboardLayout>
    </BrowserRouter>
  );
}
