import React from 'react';
import { Routes, Route } from 'react-router-dom';
import DashboardHome from './DashboardHome';
import CategoriesPage from '../categories/CategoriesPage';
import ProductsPage from '../products/ProductsPage';
import PurchasesPage from '../purchases/PurchasesPage';
import SalesPage from '../sales/SalesPage';
import SubscriptionsPage from '../subscriptions/SubscriptionsPage';
import SubscribersPage from '../subscribers/SubscribersPage';
import InternalSalesPage from '../internal-sales/InternalSalesPage';
import UsersPage from '../users/UsersPage';
import SettingsPage from '../settings/SettingsPage';
import CustomersPage from '../customers/CustomersPage';

const Dashboard: React.FC = () => {
  return (
    <Routes>
      <Route index element={<DashboardHome />} />
      <Route path="categories" element={<CategoriesPage />} />
      <Route path="products" element={<ProductsPage />} />
      <Route path="purchases" element={<PurchasesPage />} />
      <Route path="sales" element={<SalesPage />} />
      <Route path="subscriptions" element={<SubscriptionsPage />} />
      <Route path="subscribers" element={<SubscribersPage />} />
      <Route path="internal-sales" element={<InternalSalesPage />} />
      <Route path="customers" element={<CustomersPage />} />
      <Route path="users" element={<UsersPage />} />
      <Route path="settings" element={<SettingsPage />} />
    </Routes>
  );
};

export default Dashboard;