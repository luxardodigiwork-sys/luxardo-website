import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';

import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import CollectionsPage from './pages/CollectionsPage';
import CollectionDetailPage from './pages/CollectionDetailPage';
import PrimeMembershipPage from './pages/PrimeMembershipPage';
import PrimeMembershipCheckoutPage from './pages/PrimeMembershipCheckoutPage';
import PrimeMembershipSuccessPage from './pages/PrimeMembershipSuccessPage';
import PrimeMembershipFailedPage from './pages/PrimeMembershipFailedPage';
import MembershipTermsPage from './pages/MembershipTermsPage';
import CraftsmanshipPage from './pages/CraftsmanshipPage';
import OurStoryPage from './pages/OurStoryPage';
import WholesalePage from './pages/WholesalePage';
import ContactPage from './pages/ContactPage';
import FAQPage from './pages/FAQPage';
import ShippingPolicyPage from './pages/ShippingPolicyPage';
import ReturnsPolicyPage from './pages/ReturnsPolicyPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsPage from './pages/TermsPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import AccountPage from './pages/AccountPage';
import OrderDetailsPage from './pages/OrderDetailsPage';
import LoginPage from './pages/LoginPage';
import ProductPage from './pages/ProductPage';
import BespokeRequestPage from './pages/BespokeRequestPage';
import StyleConsultationPage from './pages/StyleConsultationPage';
import FabricLibraryPage from './pages/FabricLibraryPage';

import { WishlistProvider } from './context/WishlistContext';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';

import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';

// Admin imports
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import AdminOrderDetailsPage from './pages/admin/AdminOrderDetailsPage';
import AdminProductsPage from './pages/admin/AdminProductsPage';
import AdminCollectionsPage from './pages/admin/AdminCollectionsPage';
import AdminAddProductPage from './pages/admin/AdminAddProductPage';
import AdminEditProductPage from './pages/admin/AdminEditProductPage';
import AdminContentPage from './pages/admin/AdminContentPage';
import AdminMediaPage from './pages/admin/AdminMediaPage';
import AdminPoliciesPage from './pages/admin/AdminPoliciesPage';
import AdminPrimeContentPage from './pages/admin/AdminPrimeContentPage';
import AdminBespokeRequestsPage from './pages/admin/AdminBespokeRequestsPage';
import AdminPrimeMembersPage from './pages/admin/AdminPrimeMembersPage';
import AdminDispatchManagementPage from './pages/admin/DispatchManagementPage';
import DispatchDashboardPage from './pages/dispatch/DispatchDashboardPage';
import BackendGatewayPage from './pages/BackendGatewayPage';
import DispatchLayout from './components/dispatch/DispatchLayout';
import ProtectedDispatchRoute from './components/dispatch/ProtectedDispatchRoute';

import AdminLayout from './components/admin/AdminLayout';
import ProtectedAdminRoute from './components/admin/ProtectedAdminRoute';

export default function App() {
  // ... (Lenis initialization remains the same)
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
      infinite: false,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <ScrollToTop />
          <Routes>
            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLoginPage />} />

            <Route path="/admin" element={<ProtectedAdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="orders" element={<AdminOrdersPage />} />
                <Route path="orders/:id" element={<AdminOrderDetailsPage />} />
                <Route path="products" element={<AdminProductsPage />} />
                <Route path="collections" element={<AdminCollectionsPage />} />
                <Route path="products/new" element={<AdminAddProductPage />} />
                <Route path="products/:id/edit" element={<AdminEditProductPage />} />
                <Route path="content" element={<AdminContentPage />} />
                <Route path="media" element={<AdminMediaPage />} />
                <Route path="prime-content" element={<AdminPrimeContentPage />} />
                <Route path="policies" element={<AdminPoliciesPage />} />
                <Route path="bespoke-requests" element={<AdminBespokeRequestsPage />} />
                <Route path="prime-members" element={<AdminPrimeMembersPage />} />
                <Route path="dispatch-management" element={<AdminDispatchManagementPage />} />
              </Route>
            </Route>

            {/* Dispatch Portal Routes */}
            <Route path="/dispatch/login" element={<Navigate to="/backend" replace />} />
            <Route path="/dispatch" element={<ProtectedDispatchRoute />}>
              <Route element={<DispatchLayout />}>
                <Route index element={<Navigate to="/dispatch/dashboard" replace />} />
                <Route path="dashboard" element={<DispatchDashboardPage />} />
              </Route>
            </Route>

            {/* Backend Gateway & Other Portals */}
            <Route path="/backend" element={<BackendGatewayPage />} />
            <Route path="/analysis/login" element={<Navigate to="/backend" replace />} />
            <Route path="/accounts/login" element={<Navigate to="/backend" replace />} />
            <Route path="/owner/login" element={<Navigate to="/backend" replace />} />
            <Route path="/analysis" element={localStorage.getItem('luxardo_analysis_auth') === 'true' ? <div className="min-h-screen bg-brand-bg flex items-center justify-center font-serif italic text-2xl">Analysis Dashboard Placeholder</div> : <Navigate to="/backend" replace />} />
            <Route path="/accounts" element={localStorage.getItem('luxardo_accounts_auth') === 'true' ? <div className="min-h-screen bg-brand-bg flex items-center justify-center font-serif italic text-2xl">Accounts Dashboard Placeholder</div> : <Navigate to="/backend" replace />} />
            <Route path="/owner" element={localStorage.getItem('luxardo_owner_auth') === 'true' ? <div className="min-h-screen bg-brand-bg flex items-center justify-center font-serif italic text-2xl">Owner Dashboard Placeholder</div> : <Navigate to="/backend" replace />} />

            {/* Public Routes */}
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              {/* ... other routes ... */}
              <Route path="collections" element={<CollectionsPage />} />
              <Route path="collections/:category" element={<CollectionDetailPage />} />
              <Route path="prime-membership" element={<PrimeMembershipPage />} />
              <Route path="prime-membership/checkout" element={<ProtectedRoute><PrimeMembershipCheckoutPage /></ProtectedRoute>} />
              <Route path="prime-membership/success" element={<ProtectedRoute><PrimeMembershipSuccessPage /></ProtectedRoute>} />
              <Route path="prime-membership/failed" element={<PrimeMembershipFailedPage />} />
              <Route path="prime-membership/bespoke-request" element={<ProtectedRoute><BespokeRequestPage /></ProtectedRoute>} />
              <Route path="prime-membership/style-consultation" element={<ProtectedRoute><StyleConsultationPage /></ProtectedRoute>} />
              <Route path="prime-membership/fabric-library" element={<ProtectedRoute><FabricLibraryPage /></ProtectedRoute>} />
              <Route path="policies/membership-terms" element={<MembershipTermsPage />} />
              <Route path="private-client-services/*" element={<Navigate to="/prime-membership" replace />} />
              <Route path="craftsmanship" element={<CraftsmanshipPage />} />
              <Route path="our-story" element={<OurStoryPage />} />
              <Route path="wholesale" element={<WholesalePage />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="faq" element={<FAQPage />} />
              <Route path="policies/shipping" element={<ShippingPolicyPage />} />
              <Route path="policies/returns" element={<ReturnsPolicyPage />} />
              <Route path="policies/privacy" element={<PrivacyPolicyPage />} />
              <Route path="policies/terms" element={<TermsPage />} />
              <Route path="cart" element={<CartPage />} />
              <Route path="checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
              <Route path="order-confirmation" element={<OrderConfirmationPage />} />
              <Route path="account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
              <Route path="account/orders/:orderId" element={<ProtectedRoute><OrderDetailsPage /></ProtectedRoute>} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="forgot-password" element={<ForgotPasswordPage />} />
              <Route path="product/:id" element={<ProductPage />} />
            </Route>
          </Routes>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}
