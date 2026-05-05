import React, { useState, useEffect } from "react";
import { collection, addDoc } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { formatCurrency } from "../utils/currency";
import { SectionHeader } from "../components/SectionHeader";

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu",
  "Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman and Nicobar Islands","Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu","Delhi",
  "Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry",
];

interface CustomerForm {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
}

const emptyForm: CustomerForm = {
  fullName: "", email: "", phone: "",
  addressLine1: "", addressLine2: "",
  city: "", state: "", postalCode: "",
};

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cartItems, cartSubtotal, clearCart } = useCart();
  const { user, isAuthReady } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<CustomerForm>>({});

  useEffect(() => {
    if (isAuthReady && !user) {
      navigate("/login", { state: { from: { pathname: "/checkout" } }, replace: true });
    }
  }, [isAuthReady, user, navigate]);

  useEffect(() => {
    if (user?.email) {
      setForm((prev) => ({ ...prev, email: user.email || "" }));
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name as keyof CustomerForm]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validate = (): boolean => {
    const errors: Partial<CustomerForm> = {};
    if (!form.fullName.trim()) errors.fullName = "Full name is required";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errors.email = "Valid email is required";
    if (!form.phone.trim() || !/^[6-9]\d{9}$/.test(form.phone))
      errors.phone = "Valid 10-digit Indian mobile number required";
    if (!form.addressLine1.trim()) errors.addressLine1 = "Address is required";
    if (!form.city.trim()) errors.city = "City is required";
    if (!form.state) errors.state = "State is required";
    if (!form.postalCode.trim() || !/^\d{6}$/.test(form.postalCode))
      errors.postalCode = "Valid 6-digit pincode required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      setError("Your cart is empty. Add items before checkout.");
      return;
    }
    if (!validate()) {
      setError("Please fill all required fields correctly.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      let currentUser = auth.currentUser;
      if (!currentUser) {
        const anonResult = await signInAnonymously(auth);
        currentUser = anonResult.user;
      }
      const orderItems = cartItems.map((item) => ({
        productId: item.product.id,
        title: item.product.title || item.product.name || "Product",
        quantity: item.quantity,
        size: item.size || "N/A",
        price: item.product.price,
        subtotal: item.product.price * item.quantity,
      }));
      const orderData = {
        userId: currentUser.uid,
        userEmail: currentUser.email || form.email.trim().toLowerCase(),
        createdAt: new Date().toISOString(),
        totalAmount: cartSubtotal,
        status: "pending",
        paymentStatus: "pending",
        paymentMethod: "COD",
        items: orderItems,
        customer: {
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
        },
        shippingAddress: {
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          addressLine1: form.addressLine1.trim(),
          addressLine2: form.addressLine2.trim(),
          city: form.city.trim(),
          state: form.state,
          postalCode: form.postalCode.trim(),
          country: "India",
        },
        courierPartner: "DTDC",
        trackingId: null,
      };
      const docRef = await addDoc(collection(db, "orders"), orderData);
      clearCart();
      navigate("/order-confirmation", {
        replace: true,
        state: { order: { id: docRef.id, ...orderData } },
      });
    } catch (err: any) {
      console.error("Order error:", err);
      if (err?.code === "permission-denied") {
        setError("Permission denied. Please refresh and try again.");
      } else {
        setError("Order failed: " + (err?.message || "Unknown error"));
      }
      setIsSubmitting(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="section-padding min-h-[70vh] flex items-center justify-center">
        <p className="text-brand-secondary">Loading...</p>
      </div>
    );
  }

  const inputClass = "w-full rounded-2xl border border-brand-divider bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-black transition";
  const errorClass = "text-xs text-red-500 mt-1";
  const labelClass = "block text-xs font-semibold uppercase tracking-widest text-brand-secondary mb-1";

  return (
    <div className="section-padding min-h-[70vh] max-w-[1200px] mx-auto">
      <SectionHeader title="Checkout" subtitle="Complete your details to place your order." />
      {cartItems.length === 0 ? (
        <div className="mt-12 rounded-xl border border-brand-divider bg-white p-10 text-center">
          <p className="text-xl font-semibold">Your cart is empty.</p>
          <p className="mt-4 text-brand-secondary">Add products to continue to checkout.</p>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-8">
            <div className="rounded-3xl border border-brand-divider bg-white p-8 space-y-5">
              <h2 className="text-2xl font-display">Contact Information</h2>
              <div>
                <label className={labelClass}>Full Name *</label>
                <input type="text" name="fullName" value={form.fullName} onChange={handleChange} placeholder="Your full name" className={inputClass} />
                {formErrors.fullName && <p className={errorClass}>{formErrors.fullName}</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Email Address *</label>
                  <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="you@email.com" className={inputClass} />
                  {formErrors.email && <p className={errorClass}>{formErrors.email}</p>}
                </div>
                <div>
                  <label className={labelClass}>Mobile Number *</label>
                  <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="10-digit mobile" maxLength={10} className={inputClass} />
                  {formErrors.phone && <p className={errorClass}>{formErrors.phone}</p>}
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-brand-divider bg-white p-8 space-y-5">
              <h2 className="text-2xl font-display">Delivery Address</h2>
              <div>
                <label className={labelClass}>Address Line 1 *</label>
                <input type="text" name="addressLine1" value={form.addressLine1} onChange={handleChange} placeholder="House/Flat no., Street, Area" className={inputClass} />
                {formErrors.addressLine1 && <p className={errorClass}>{formErrors.addressLine1}</p>}
              </div>
              <div>
                <label className={labelClass}>Address Line 2 (Optional)</label>
                <input type="text" name="addressLine2" value={form.addressLine2} onChange={handleChange} placeholder="Landmark, Building name" className={inputClass} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>City *</label>
                  <input type="text" name="city" value={form.city} onChange={handleChange} placeholder="City" className={inputClass} />
                  {formErrors.city && <p className={errorClass}>{formErrors.city}</p>}
                </div>
                <div>
                  <label className={labelClass}>Pincode *</label>
                  <input type="text" name="postalCode" value={form.postalCode} onChange={handleChange} placeholder="6-digit pincode" maxLength={6} className={inputClass} />
                  {formErrors.postalCode && <p className={errorClass}>{formErrors.postalCode}</p>}
                </div>
              </div>
              <div>
                <label className={labelClass}>State *</label>
                <select name="state" value={form.state} onChange={handleChange} className={inputClass}>
                  <option value="">Select state</option>
                  {INDIAN_STATES.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
                {formErrors.state && <p className={errorClass}>{formErrors.state}</p>}
              </div>
            </div>
            <div className="rounded-3xl border border-brand-divider bg-white p-8 space-y-4">
              <h2 className="text-2xl font-display">Items in Order</h2>
              {cartItems.map((item) => (
                <div key={item.product.id + "-" + (item.size || "default")} className="rounded-2xl border border-brand-divider p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center">
                    <div>
                      <p className="font-semibold">{item.product.title || item.product.name}</p>
                      {item.size && <p className="text-sm text-brand-secondary">Size: {item.size}</p>}
                      <p className="text-sm text-brand-secondary">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-semibold">{formatCurrency(item.product.price * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <div className="sticky top-24 rounded-3xl border border-brand-divider bg-white p-8 space-y-6">
              <div>
                <h2 className="text-2xl font-display">Order Summary</h2>
                <p className="text-sm text-brand-secondary mt-1">Review before placing</p>
              </div>
              <div className="rounded-2xl bg-brand-surface p-5 space-y-3">
                <div className="flex items-center justify-between text-sm text-brand-secondary">
                  <span>Subtotal ({cartItems.length} items)</span>
                  <span>{formatCurrency(cartSubtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-brand-secondary">
                  <span>Shipping</span>
                  <span className="text-green-600 font-medium">Free</span>
                </div>
                <div className="flex items-center justify-between border-t border-brand-divider pt-3 text-lg font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(cartSubtotal)}</span>
                </div>
              </div>
              <div className="rounded-2xl border border-brand-divider p-4 text-xs text-brand-secondary space-y-1">
                <p>• Cash on Delivery (COD)</p>
                <p>• Shipped via DTDC courier</p>
                <p>• Estimated delivery: 5-7 business days</p>
              </div>
              {error && (
                <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-sm text-red-700">{error}</div>
              )}
              <button type="button" onClick={handlePlaceOrder} disabled={isSubmitting} className="btn-primary w-full px-6 py-4 text-base font-semibold disabled:opacity-60">
                {isSubmitting ? "Placing Order..." : "Place Order"}
              </button>
              <p className="text-xs text-center text-brand-secondary">
                By placing your order, you agree to our <a href="/terms" className="underline">Terms</a> and <a href="/shipping-policy" className="underline">Shipping Policy</a>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
