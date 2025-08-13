import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

// Contexts
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { GymProvider } from './contexts/GymContext';

// Components
import LoginPage from './components/auth/LoginPage';
import Dashboard from './components/dashboard/Dashboard';
import Layout from './components/layout/Layout';
import LoadingSpinner from './components/common/LoadingSpinner';
import QuickSaleModal from './components/sales/QuickSaleModal';

// Styles
import './styles/arabic.css';

function AppContent() {
  const { user, loading } = useAuth();
  const [showQuickSale, setShowQuickSale] = useState(false);
  const navigate = useNavigate();

  const handleCloseQuickSale = useCallback(() => {
    setShowQuickSale(false);
  }, []);

  // إضافة مستمع لحدث openQuickSale
  useEffect(() => {
    const openQuickSaleModal = () => setShowQuickSale(true);
    window.addEventListener('openQuickSale', openQuickSaleModal);
    return () => {
      window.removeEventListener('openQuickSale', openQuickSaleModal);
    };
  }, []);

  // useEffect للاستماع لضغطات لوحة المفاتيح
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isInputActive = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      
      // تجاهل الاختصارات إذا كان المستخدم يكتب في حقل إدخال
      if (isInputActive) {
        return;
      }

      // اختصار زر المسافة لفتح الفاتورة السريعة
      if (event.code === 'Space' && user && !showQuickSale) {
        event.preventDefault();
        setShowQuickSale(true);
      }
      
      // اختصار زر Enter لفتح صفحة إضافة مشترك
      else if (event.code === 'Enter' && user && !showQuickSale) {
        event.preventDefault();
        navigate('/dashboard/subscribers');
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [user, showQuickSale, navigate]);

  if (loading) {
    return (
      <div className="app-loading" dir="rtl">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="app" dir="rtl">
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
        />
        <Route
          path="/dashboard/*"
          element={
            user ? (
              <Layout>
                <Dashboard />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      {user && (
        <QuickSaleModal
          isOpen={showQuickSale}
          onClose={handleCloseQuickSale}
        />
      )}
    </div>
  );
}

function AppWithGym() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-loading" dir="rtl">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <AppContent />;
  }

  return (
    <GymProvider>
      <AppContent />
    </GymProvider>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppWithGym />
      </AuthProvider>
    </Router>
  );
}
