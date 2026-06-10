import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import FlowsListPage from '@/pages/flows/FlowsListPage';
import FlowEditorPage from '@/pages/flows/FlowEditorPage';
import ConnectionsPage from '@/pages/connections/ConnectionsPage';
import ConversationsPage from '@/pages/conversations/ConversationsPage';
import ContactsPage from '@/pages/contacts/ContactsPage';
import Sidebar from '@/components/layout/Sidebar';

function ProtectedLayout() {
  const { accessToken } = useAuthStore();

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden ml-0 md:ml-60">
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function App() {
  const { loadFromStorage } = useAuthStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/flows" element={<FlowsListPage />} />
          <Route path="/flows/:id/edit" element={<FlowEditorPage />} />
          <Route path="/connections" element={<ConnectionsPage />} />
          <Route path="/conversations" element={<ConversationsPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
