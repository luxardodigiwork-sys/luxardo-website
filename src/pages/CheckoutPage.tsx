import React, { useState, useEffect } from "react";
import { collection, addDoc } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { httpsCallable, getFunctions } from "firebase/functions";
import { db, auth } from "../firebase";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { formatCurrency } from "../utils/currency";
import { SectionHeader } from "../components/SectionHeader";
import { isCODEligible, BUSINESS_CONFIG } from "../constants/businessConfig";

type PaymentMethod = "razorpay" | "cod";

// Lazily inject Razorpay Checkout script
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("razorpay");
  const [pincodeLookup, setPincodeLookup] = useState<{ status: 'idle' | 'loading' | 'ok' | 'err'; msg?: string }>({ status: 'idle' });

  // Task #10 — Country whitelist: only India for now
  const ALLOWED_COUNTRY = "India";

  // Task #9 — Auto-fill city + state from pincode (India Post API, free, no key)
  useEffect(() => {
    const pin = form.postalCode?.trim();
    if (!pin || !/^\d{6}$/.test(pin)) {
      setPincodeLookup({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setPincodeLookup({ status: 'loading' });
    fetch(`https://api.postalpincode.in/pincode/${pin}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const entry = Array.isArray(data) ? data[0] : null;
        if (entry?.Status === 'Success' && entry?.PostOffice?.[0]) {
          const po = entry.PostOffice[0];
          setForm((prev) => ({
            ...prev,
            city: prev.city || po.District || po.Name || prev.city,
            state: prev.state || po.State || prev.state,
          }));
          setPincodeLookup({ status: 'ok', msg: `${po.District}, ${po.State}` });
        } else {
          setPincodeLookup({ status: 'err', msg: 'Pincode not found in postal directory' });
        }
      })
      .catch(() => {
        if (!cancelled) setPincodeLookup({ status: 'err', msg: 'Network error checking pincode' });
      });
    return () => { cancelled = true; };
  }, [form.postalCode]);

  const codEligible = isCODEligible(form.postalCode || "");
  // If user had selected COD but pincode is no longer eligible, flip back to razorpay
  useEffect(() => {
    if (paymentMethod === "cod" && !codEligible) {
      setPaymentMethod("razorpay");
    }
  }, [codEligible, paymentMethod]);

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

  const buildOrderPayload = (currentUser: any, paymentStatusOverride?: string, razorpayMeta?: any) => {
    const orderItems = cartItems.map((item) => ({
      productId: item.product.id,
      title: item.product.name || "Product",
      quantity: item.quantity,
      size: item.size || "N/A",
      price: item.product.price,
      subtotal: item.product.price * item.quantity,
    }));

    return {
      userId: currentUser.uid,
      userEmail: currentUser.email || form.email.trim().toLowerCase(),
      userName: form.fullName.trim(),
      createdAt: new Date().toISOString(),
      totalAmount: cartSubtotal,
      status: "pending",
      paymentStatus: paymentStatusOverride || (paymentMethod === "cod" ? "pending" : "pending"),
      paymentMethod: paymentMethod === "cod" ? "COD" : "razorpay",
      ...(razorpayMeta && { razorpay: razorpayMeta }),
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
  };

  const handleCODOrder = async (currentUser: any) => {
    const orderData = buildOrderPayload(currentUser);
    const docRef = await addDoc(collection(db, "orders"), orderData);
    clearCart();
    navigate("/order-confirmation", {
      replace: true,
      state: { order: { id: docRef.id, ...orderData } },
    });
  };

  const handleRazorpayOrder = async (currentUser: any) => {
    const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
    if (!keyId) {
      throw new Error("Razorpay not configured. Set VITE_RAZORPAY_KEY_ID in .env and rebuild.");
    }
    const scriptOk = await loadRazorpayScript();
    if (!scriptOk) {
      throw new Error("Razorpay SDK failed to load. Check your network and try again.");
    }

    // 1. Create order on Cloud Function (server creates Razorpay order with key_secret)
    const functions = getFunctions(undefined, "us-central1");
    const createOrder = httpsCallable(functions, "createRazorpayOrder");
    const result: any = await createOrder({
      amount: Math.round(cartSubtotal * 100), // paise
      currency: "INR",
      receipt: `LXF-${Date.now()}-${currentUser.uid.substring(0, 6)}`,
      notes: { email: form.email, phone: form.phone },
    });
    const { razorpayOrderId } = result.data;
    if (!razorpayOrderId) throw new Error("Failed to create Razorpay order");

    // 2. Open Razorpay Checkout
    return new Promise<void>((resolve, reject) => {
      const rzp = new (window as any).Razorpay({
        key: keyId,
        amount: Math.round(cartSubtotal * 100),
        currency: "INR",
        name: BUSINESS_CONFIG.brandName,
        description: `Order — ${cartItems.length} item${cartItems.length > 1 ? "s" : ""}`,
        order_id: razorpayOrderId,
        prefill: {
          name: form.fullName,
          email: form.email,
          contact: form.phone,
        },
        theme: { color: "#000000" },
        handler: async (response: any) => {
          try {
            // 3. Verify signature on server
            const verifyFn = httpsCallable(functions, "verifyRazorpayPayment");
            const verifyRes: any = await verifyFn({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            if (!verifyRes.data?.verified) {
              return reject(new Error("Payment verification failed"));
            }

            // 4. Create Firestore order with paymentStatus=paid + razorpay metadata
            const orderData = buildOrderPayload(currentUser, "paid", {
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              paidAt: new Date().toISOString(),
            });
            const docRef = await addDoc(collection(db, "orders"), orderData);
            clearCart();
            navigate("/order-confirmation", {
              replace: true,
              state: { order: { id: docRef.id, ...orderData } },
            });
            resolve();
          } catch (err) {
            reject(err);
          }
        },
        modal: {
          ondismiss: () => {
            setIsSubmitting(false);
            setError("Payment cancelled. You can try again or switch to COD.");
            reject(new Error("Payment dismissed by user"));
          },
        },
      });
      rzp.on("payment.failed", (resp: any) => {
        reject(new Error(resp.error?.description || "Payment failed"));
      });
      rzp.open();
    });
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
    if (paymentMethod === "cod" && !codEligible) {
      setError("COD is not available for your pincode. Please choose Razorpay/prepaid.");
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
      if (paymentMethod === "cod") {
        await handleCODOrder(currentUser);
      } else {
        await handleRazorpayOrder(currentUser);
      }
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
                  {pincodeLookup.status === 'loading' && <p className="text-[10px] text-brand-secondary mt-1">Checking pincode...</p>}
                  {pincodeLookup.status === 'ok' && <p className="text-[10px] text-emerald-700 mt-1">✓ {pincodeLookup.msg} (auto-filled)</p>}
                  {pincodeLookup.status === 'err' && <p className="text-[10px] text-amber-700 mt-1">⚠ {pincodeLookup.msg}</p>}
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
              {/* Country whitelist notice */}
              <div className="rounded-2xl bg-brand-bg border border-brand-divider p-3 text-xs text-brand-secondary flex items-center gap-3">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>Currently shipping to <strong>{ALLOWED_COUNTRY}</strong> only. International orders coming soon.</span>
              </div>
            </div>

            <div className="rounded-3xl border border-brand-divider bg-white p-8 space-y-4">
              <h2 className="text-2xl font-display">Items in Order</h2>
              {cartItems.map((item) => (
                <div key={item.product.id + "-" + (item.size || "default")} className="rounded-2xl border border-brand-divider p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center">
                    <div>
                      <p className="font-semibold">{item.product.name || "Product"}</p>
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
              {/* Payment method selector */}
              <div className="space-y-3">
                <h3 className="text-xs uppercase tracking-widest font-bold text-brand-secondary">Payment Method</h3>

                <label className={`flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition ${
                  paymentMethod === "razorpay" ? "border-brand-black bg-brand-bg" : "border-brand-divider hover:border-brand-black/40"
                }`}>
                  <input
                    type="radio"
                    name="pay"
                    value="razorpay"
                    checked={paymentMethod === "razorpay"}
                    onChange={() => setPaymentMethod("razorpay")}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Prepaid · Razorpay</p>
                    <p className="text-xs text-brand-secondary mt-1">Cards, UPI, Netbanking, Wallets · Secure payment gateway</p>
                  </div>
                </label>

                <label className={`flex items-start gap-3 rounded-2xl border p-4 transition ${
                  !codEligible
                    ? "border-brand-divider opacity-50 cursor-not-allowed"
                    : paymentMethod === "cod"
                      ? "border-brand-black bg-brand-bg cursor-pointer"
                      : "border-brand-divider hover:border-brand-black/40 cursor-pointer"
                }`}>
                  <input
                    type="radio"
                    name="pay"
                    value="cod"
                    disabled={!codEligible}
                    checked={paymentMethod === "cod"}
                    onChange={() => setPaymentMethod("cod")}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Cash on Delivery (COD)</p>
                    {form.postalCode && form.postalCode.length === 6 ? (
                      codEligible ? (
                        <p className="text-xs text-emerald-700 mt-1">✓ Available for pincode {form.postalCode}</p>
                      ) : (
                        <p className="text-xs text-red-600 mt-1">Not available for pincode {form.postalCode}. Choose Razorpay above.</p>
                      )
                    ) : (
                      <p className="text-xs text-brand-secondary mt-1">Enter pincode above to check COD availability</p>
                    )}
                  </div>
                </label>
              </div>

              <div className="rounded-2xl border border-brand-divider p-4 text-xs text-brand-secondary space-y-1">
                <p>• Shipped via DTDC courier</p>
                <p>• Estimated delivery: 5-7 business days</p>
                <p>• Free shipping on orders above {formatCurrency(BUSINESS_CONFIG.freeShippingMinAmount)}</p>
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
