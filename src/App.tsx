import React, { useEffect, useState, lazy, Suspense } from "react";
import { EXPRESS_BACKEND_AVAILABLE } from './constants/features';
import { Routes, Route, Navigate } from "react-router-dom";
import { BackendPermissions } from "./types";
import Lenis from "lenis";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

import HomePage from "./pages/HomePage";
const CollectionsPage = lazy(() => import("./pages/CollectionsPage"));
const CollectionDetailPage = lazy(() => import("./pages/CollectionDetailPage"));
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
const FAQPage = lazy(() => import("./pages/FAQPage"));
const ShippingPolicyPage = lazy(() => import("./pages/ShippingPolicyPage"));
const ReturnsPolicyPage = lazy(() => import("./pages/ReturnsPolicyPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const OrderConfirmationPage = lazy(() => import("./pages/OrderConfirmationPage"));
const TrackOrderPage = lazy(() => import("./pages/TrackOrderPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const OrderDetailsPage = lazy(() => import("./pages/OrderDetailsPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ProductPage = lazy(() => import("./pages/ProductPage"));
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
import { PRIME_AVAILABLE } from "./constants/features";

const RegisterPage = lazy(() => import("./pages/RegisterPage"));

// Admin imports
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
const DispatchDashboardPage = lazy(() => import("./pages/dispatch/DispatchDashboardPage"));
import DispatchLayout from "./components/dispatch/DispatchLayout";

import AdminLayout from "./components/admin/AdminLayout";

import OwnerLayout from "./components/owner/OwnerLayout";
const OwnerDashboardPage = lazy(() => import("./pages/owner/OwnerDashboardPage"));
import ProtectedAdminRoute from "./components/admin/ProtectedAdminRoute";
const StaffLoginPage = lazy(() => import("./pages/StaffLoginPage"));
const AdminStaffPage = lazy(() => import("./pages/admin/AdminStaffPage"));
import CookieConsent from "./components/CookieConsent";
import { CHECKOUT_ENABLED } from "./constants/features";

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
  setIsInitializing(false);
}, []);

  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1.2,
      touchMultiplier: 1.5,
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

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col gap-6 items-center justify-center font-display uppercase tracking-widest text-sm text-brand-black">
        <div className="w-12 h-12 border-t-2 border-r-2 border-brand-black rounded-full animate-spin"></div>
        <p className="animate-pulse">Loading LUXARDO FASHION...</p>
      </div>
    );
  }

  return (
    <AuthProvider>
      <CountryProvider>
        <CountryModalBridge />
      <ProductsProvider>
      <CartProvider>
        <WishlistProvider>
          <CookieConsent />
          <Suspense fallback={<div role="status" className="p-8 text-center">Loading page...</div>}>
          <Routes>
            <Route path="/backend/login" element={<StaffLoginPage />} />
            <Route path="/admin/login" element={<Navigate to="/backend/login" replace />} />

            <Route path="/admin">
              <Route element={<ProtectedAdminRoute><AdminLayout /></ProtectedAdminRoute>}>
                <Route
                  index
                  element={<Navigate to="/admin/dashboard" replace />}
                />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="dispatch" element={<AdminDispatchPage />} />
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
                  path="backend-management"
                  element={EXPRESS_BACKEND_AVAILABLE ? <AdminBackendManagementPage /> : <Navigate to="/admin" replace />}
                />
                <Route path="staff" element={<AdminStaffPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
              </Route>
            </Route>

            <Route
              path="/dispatch/login"
              element={<Navigate to="/backend/login" replace />}
            />
            <Route
              path="/dispatch"
              element={
                <ProtectedAdminRoute area="dispatch">
                  <DispatchLayout />
                </ProtectedAdminRoute>
              }
            >
              <Route
                index
                element={<Navigate to="/dispatch/dashboard" replace />}
              />
              <Route path="dashboard" element={<DispatchDashboardPage />} />
            </Route>

            <Route path="/backend" element={<Navigate to="/backend/login" replace />} />
            <Route
              path="/admin-access"
              caseSensitive={false}
              element={<Navigate to="/backend/login" replace />}
            />
            <Route
              path="/ADMIN-ACCESS"
              element={<Navigate to="/backend/login" replace />}
            />
            <Route
              path="/analysis/login"
              element={<Navigate to="/backend/login" replace />}
            />
            <Route
              path="/owner/login"
              element={<Navigate to="/backend/login" replace />}
            />
            <Route
              path="/owner"
              element={
                <ProtectedAdminRoute area="owner">
                  <OwnerLayout />
                </ProtectedAdminRoute>
              }
            >
              <Route
                index
                element={<Navigate to="/owner/dashboard" replace />}
              />
              <Route path="dashboard" element={<OwnerDashboardPage />} />
              <Route path="orders/:id" element={<AdminOrderDetailsPage />} />
            </Route>
            {/* Analysis area is disabled for now (only admin, owner and dispatch are active). */}
            <Route path="/analysis/*" element={<Navigate to="/backend/login" replace />} />

            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="collections" element={<CollectionsPage />} />
              <Route
                path="collections/:category"
                element={<CollectionDetailPage />}
              />
              {PRIME_AVAILABLE ? (
                <>
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
                // No payment can complete while Prime checkout is disabled; never show a fake success page.
                element={<Navigate to="/prime-membership" replace />}
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
                </>
              ) : (
                <>
                  {/* Prime is unavailable until after launch: every Prime URL goes to the home page. */}
                  <Route path="prime-membership/*" element={<Navigate to="/" replace />} />
                  <Route path="prime-dashboard" element={<Navigate to="/" replace />} />
                  <Route path="policies/membership-terms" element={<Navigate to="/" replace />} />
                  <Route path="private-client-services/*" element={<Navigate to="/" replace />} />
                </>
              )}
              <Route path="craftsmanship" element={<CraftsmanshipPage />} />
              <Route path="our-story" element={<OurStoryPage />} />
              <Route path="wholesale" element={<WholesalePage />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="faq" element={<FAQPage />} />
              <Route
                path="policies/shipping"
                element={<ShippingPolicyPage />}
              />
              <Route path="policies/returns" element={<ReturnsPolicyPage />} />
              <Route path="policies/privacy" element={<PrivacyPolicyPage />} />
              <Route path="policies/terms" element={<TermsPage />} />
              <Route path="cart" element={<CartPage />} />
              <Route
                path="checkout"
                element={
                  CHECKOUT_ENABLED ? (
                    <ProtectedRoute>
                      <CheckoutPage />
                    </ProtectedRoute>
                  ) : (
                    <Navigate to="/cart" replace />
                  )
                }
              />
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
              <Route path="register" element={<Navigate to="/login" replace />} />
              <Route path="product/:id" element={<ProductPage />} />
            </Route>
          </Routes>
          </Suspense>
        </WishlistProvider>
      </CartProvider>
      </ProductsProvider>
      </CountryProvider>
    </AuthProvider>
  );
}