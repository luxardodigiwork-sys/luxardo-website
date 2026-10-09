import React, { Suspense, lazy, useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { BackendPermissions } from "./types";
import Lenis from "lenis";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

import HomePage from "./pages/HomePage";
import CollectionsPage from "./pages/CollectionsPage";
import CollectionDetailPage from "./pages/CollectionDetailPage";
const PrimePage = lazy(() => import("./pages/PrimePage"));
const PrimeMembershipCheckoutPage = lazy(() => import("./pages/PrimeMembershipCheckoutPage"));
const PrimeMembershipSuccessPage = lazy(() => import("./pages/PrimeMembershipSuccessPage"));
const PrimeMembershipFailedPage = lazy(() => import("./pages/PrimeMembershipFailedPage"));
const PrimeDashboardPage = lazy(() => import("./pages/PrimeDashboardPage"));
const MembershipTermsPage = lazy(() => import("./pages/MembershipTermsPage"));
const CraftsmanshipPage = lazy(() => import("./pages/CraftsmanshipPage"));
const OurStoryPage = lazy(() => import("./pages/OurStoryPage"));
const WholesalePage = lazy(() => import("./pages/WholesalePage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const FAQPage = lazy(() => import("./pages/FAQPage"));
const ShippingPolicyPage = lazy(() => import("./pages/ShippingPolicyPage"));
const ReturnsPolicyPage = lazy(() => import("./pages/ReturnsPolicyPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderConfirmationPage from "./pages/OrderConfirmationPage";
const TrackOrderPage = lazy(() => import("./pages/TrackOrderPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const OrderDetailsPage = lazy(() => import("./pages/OrderDetailsPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
import ProductPage from "./pages/ProductPage";
const BespokeRequestPage = lazy(() => import("./pages/BespokeRequestPage"));
const StyleConsultationPage = lazy(() => import("./pages/StyleConsultationPage"));
const FabricLibraryPage = lazy(() => import("./pages/FabricLibraryPage"));

import { WishlistProvider } from "./context/WishlistContext";
import { CountryProvider, useCountry } from "./context/CountryContext";
import { FirstVisitModal } from "./components/FirstVisitModal";
import { AuthProvider, useAuth } from "./context/AuthContext";

function CountryModalBridge() {
  const { showModal, setCountry } = useCountry();
  if (!showModal) return null;
  return <FirstVisitModal onSelect={setCountry} />;
}
import { CartProvider } from "./context/CartContext";
import { ProductsProvider } from "./context/ProductsContext";
import { syncSiteContentFromFirestore, subscribeSiteContent } from "./utils/siteContentSync";
import { fetchProductsFromFirestore } from "./utils/productsFirestore";

import RegisterPage from "./pages/RegisterPage";

// Admin + role login pages (each role has dedicated login route)
const AdminLoginPage = lazy(() => import("./pages/admin/AdminLoginPage"));
const OwnerLoginPage = lazy(() => import("./pages/owner/OwnerLoginPage"));
const DispatchLoginPage = lazy(() => import("./pages/dispatch/DispatchLoginPage"));
const AccountsLoginPage = lazy(() => import("./pages/accounts/AccountsLoginPage"));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminDispatchPage = lazy(() => import("./pages/admin/AdminDispatchPage"));
const AdminOrderDetailsPage = lazy(() => import("./pages/admin/AdminOrderDetailsPage"));
const AdminProductsPage = lazy(() => import("./pages/admin/AdminProductsPage"));
const AdminCollectionsPage = lazy(() => import("./pages/admin/AdminCollectionsPage"));
const AdminAddProductPage = lazy(() => import("./pages/admin/AdminAddProductPage"));
const AdminEditProductPage = lazy(() => import("./pages/admin/AdminEditProductPage"));
const AdminContentPage = lazy(() => import("./pages/admin/AdminContentPage"));
const AdminMediaPage = lazy(() => import("./pages/admin/AdminMediaPage"));
const AdminPoliciesPage = lazy(() => import("./pages/admin/AdminPoliciesPage"));
const AdminPrimeContentPage = lazy(() => import("./pages/admin/AdminPrimeContentPage"));
const AdminBespokeRequestsPage = lazy(() => import("./pages/admin/AdminBespokeRequestsPage"));
const AdminPrimeMembersPage = lazy(() => import("./pages/admin/AdminPrimeMembersPage"));
const AdminBackendManagementPage = lazy(() => import("./pages/admin/BackendManagementPage"));
const AdminPartnersPage = lazy(() => import("./pages/admin/AdminPartnersPage"));
const AdminContactMessagesPage = lazy(() => import("./pages/admin/AdminContactMessagesPage"));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"));
const AdminNewsletterPage = lazy(() => import("./pages/admin/AdminNewsletterPage"));
const DispatchDashboardPage = lazy(() => import("./pages/dispatch/DispatchDashboardPage"));
const BackendGatewayPage = lazy(() => import("./pages/BackendGatewayPage"));
const DispatchLayout = lazy(() => import("./components/dispatch/DispatchLayout"));

const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
import { CategoriesProvider } from "./context/CategoriesContext";
import ProtectedAdminRoute from "./components/admin/ProtectedAdminRoute";

const OwnerLayout = lazy(() => import("./components/owner/OwnerLayout"));
const OwnerDashboardPage = lazy(() => import("./pages/owner/OwnerDashboardPage"));
const AnalysisLayout = lazy(() => import("./components/analysis/AnalysisLayout"));
const AnalysisDashboardPage = lazy(() => import("./pages/analysis/AnalysisDashboardPage"));

// V1 Production System
// Phase 2 — Design → Sample Design → Sample Piece → Production Request

const ProtectedBackendRoute = ({
  role,
  permission,
  children,
}: {
  role: string;
  permission?: string;
  children: React.ReactNode;
}) => {
  const { user, isAuthReady } = useAuth();
  const location = useLocation();

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        Loading...
      </div>
    );
  }

  const isSuperAdmin = user && ["super_admin", "admin"].includes(user.role);
  const hasRole = user && user.role === role;
  const hasPermission = !permission || user?.permissions?.[permission];

  // 🚀 FIXED: Agar login nahi hai toh /backend par bhejo
  if (!user || (!isSuperAdmin && (!hasRole || !hasPermission))) {
    return <Navigate to="/backend" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

/* LUXARDO FLOW (production system) is a separate app and repo
 * (luxardo-flow). Any old /production link on the website now sends the user
 * there instead of a broken page. */
const FLOW_URL = "https://luxardo-flow.web.app";
function FlowRedirect() {
  useEffect(() => {
    window.location.replace(FLOW_URL + window.location.pathname + window.location.search);
  }, []);
  return null;
}

function ProductionRoutes() {
  return <Route path="/production/*" element={<FlowRedirect />} />;
}

/* Shown for the split second while a page's code downloads (back-office
 * screens and less-visited pages are loaded on demand, so a shopper's first
 * visit only downloads the storefront). */
function RouteFallback() {
  return <div className="min-h-[60vh]" aria-busy="true" />;
}

export default function App() {
  useEffect(() => {

    syncSiteContentFromFirestore();
    fetchProductsFromFirestore();
    
    const unsubSiteContent = subscribeSiteContent(() => {
      window.dispatchEvent(new Event('siteContentUpdated'));
    });
    
    return () => unsubSiteContent();
  }, []);

  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    const lenis = new Lenis({
      duration: 2.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -8 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 0.8,
      touchMultiplier: 1.0,
      infinite: false,
    });

    (window as any).lenis = lenis;

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);
    return () => {
      lenis.destroy();
      delete (window as any).lenis;
    };
  }, []);

  return (
    <AuthProvider>
      <CountryProvider>
        <CountryModalBridge />
      <ProductsProvider>
      <CategoriesProvider>
      <CartProvider>
        <WishlistProvider>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Dedicated login pages — one per role */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/owner/login" element={<OwnerLoginPage />} />
            <Route path="/dispatch/login" element={<DispatchLoginPage />} />
            <Route path="/accounts/login" element={<AccountsLoginPage />} />
            <Route path="/analysis/login" element={<Navigate to="/accounts/login" replace />} />

            <Route path="/admin">
              <Route element={<ProtectedAdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route
                  index
                  element={<Navigate to="/admin/dashboard" replace />}
                />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="dispatch" element={<AdminDispatchPage />} />
                <Route path="orders" element={<Navigate to="/admin/dispatch" replace />} />
                <Route path="orders/:id" element={<AdminOrderDetailsPage />} />
                <Route path="products" element={<AdminProductsPage />} />
                <Route path="collections" element={<AdminCollectionsPage />} />
                <Route path="products/new" element={<AdminAddProductPage />} />
                <Route
                  path="products/:id/edit"
                  element={<AdminEditProductPage />}
                />
                <Route path="content" element={<AdminContentPage />} />
                <Route path="media" element={<AdminMediaPage />} />
                <Route
                  path="prime-content"
                  element={<AdminPrimeContentPage />}
                />
                <Route path="policies" element={<AdminPoliciesPage />} />
                <Route
                  path="bespoke-requests"
                  element={<AdminBespokeRequestsPage />}
                />
                <Route
                  path="prime-members"
                  element={<AdminPrimeMembersPage />}
                />
                <Route path="partners" element={<AdminPartnersPage />} />
                <Route
                  path="contact-messages"
                  element={<AdminContactMessagesPage />}
                />
                <Route
                  path="newsletter"
                  element={<AdminNewsletterPage />}
                />
                <Route
                  path="backend-management"
                  element={<AdminBackendManagementPage />}
                />
                <Route path="settings" element={<AdminSettingsPage />} />
              </Route>
              </Route>
            </Route>

            <Route
              path="/dispatch"
              element={
                <ProtectedBackendRoute
                  role="dispatch"
                  permission="dispatch_actions"
                >
                  <DispatchLayout />
                </ProtectedBackendRoute>
              }
            >
              <Route
                index
                element={<Navigate to="/dispatch/dashboard" replace />}
              />
              <Route path="dashboard" element={<DispatchDashboardPage />} />
            </Route>

            <Route path="/backend" element={<BackendGatewayPage />} />
            <Route path="/admin-access" caseSensitive={false} element={<Navigate to="/admin/login" replace />} />
            <Route path="/ADMIN-ACCESS" element={<Navigate to="/admin/login" replace />} />


            <Route
              path="/owner"
              element={
                <ProtectedBackendRoute
                  role="owner"
                  permission="backend_management"
                >
                  <OwnerLayout />
                </ProtectedBackendRoute>
              }
            >
              <Route
                index
                element={<Navigate to="/owner/dashboard" replace />}
              />
              <Route path="dashboard" element={<OwnerDashboardPage />} />
              <Route path="orders/:id" element={<AdminOrderDetailsPage />} />
            </Route>
            
            <Route
              path="/analysis"
              element={
                <ProtectedBackendRoute
                  role="analysis"
                  permission="analysis_reports"
                >
                  <AnalysisLayout />
                </ProtectedBackendRoute>
              }
            >
              <Route
                index
                element={<Navigate to="/analysis/dashboard" replace />}
              />
              <Route path="dashboard" element={<AnalysisDashboardPage />} />
            </Route>

            {/* ── LUXARDO FLOW moved to its own app — redirect old links ── */}
            {ProductionRoutes()}

            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="collections" element={<CollectionsPage />} />
              <Route
                path="collections/:category"
                element={<CollectionDetailPage />}
              />
              <Route path="prime-membership" element={<PrimePage />} />
              <Route
                path="prime-dashboard"
                element={
                  <ProtectedRoute>
                    <PrimeDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="prime-membership/checkout"
                element={
                  <ProtectedRoute>
                    <PrimeMembershipCheckoutPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="prime-membership/success"
                element={
                  <ProtectedRoute>
                    <PrimeMembershipSuccessPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="prime-membership/failed"
                element={<PrimeMembershipFailedPage />}
              />
              <Route
                path="prime-membership/bespoke-request"
                element={
                  <ProtectedRoute>
                    <BespokeRequestPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="prime-membership/style-consultation"
                element={
                  <ProtectedRoute>
                    <StyleConsultationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="prime-membership/fabric-library"
                element={
                  <ProtectedRoute>
                    <FabricLibraryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="policies/membership-terms"
                element={<MembershipTermsPage />}
              />
              <Route
                path="private-client-services/*"
                element={<Navigate to="/prime-membership" replace />}
              />
              <Route path="craftsmanship" element={<CraftsmanshipPage />} />
              <Route path="our-story" element={<OurStoryPage />} />
              <Route path="wholesale" element={<WholesalePage />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="faq" element={<FAQPage />} />
              <Route
                path="policies/shipping"
                element={<ShippingPolicyPage />}
              />
              <Route path="policies/returns" element={<ReturnsPolicyPage />} />
              <Route path="policies/privacy" element={<PrivacyPolicyPage />} />
              <Route path="policies/terms" element={<TermsPage />} />
              <Route path="cart" element={<CartPage />} />
              {/* Guest checkout: CheckoutPage signs the visitor in anonymously
                  if needed, so buyers from a live stream don't have to create
                  an account before paying. Logged-in users work as before. */}
              <Route path="checkout" element={<CheckoutPage />} />
              <Route
                path="order-confirmation"
                element={<OrderConfirmationPage />}
              />
              <Route path="track-order/:orderId" element={<TrackOrderPage />} />
              <Route
                path="account"
                caseSensitive={false}
                element={
                  <ProtectedRoute>
                    <AccountPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="account/orders/:orderId"
                element={
                  <ProtectedRoute>
                    <OrderDetailsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="product/:id" element={<ProductPage />} />
            </Route>
          </Routes>
          </Suspense>
        </WishlistProvider>
      </CartProvider>
      </CategoriesProvider>
      </ProductsProvider>
      </CountryProvider>
    </AuthProvider>
  );
}