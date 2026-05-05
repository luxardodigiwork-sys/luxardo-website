import React, { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { useCart } from "../context/CartContext";
import { formatCurrency } from "../utils/currency";
import { SectionHeader } from "../components/SectionHeader";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cartItems, cartSubtotal, clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      setError("Your cart is empty. Add items before checkout.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const orderItems = cartItems.map((item) => ({
        productId: item.product.id,
        title: item.product.title || item.product.name || "Product",
        quantity: item.quantity,
        size: item.size || "N/A",
        price: item.product.price,
      }));

      await addDoc(collection(db, "orders"), {
        createdAt: new Date().toISOString(),
        totalAmount: cartSubtotal,
        status: "processing",
        items: orderItems,
      });

      clearCart();
      navigate("/order-confirmation", { replace: true });
    } catch (err) {
      console.error("Order error:", err);
      setError("Order failed. Please try again later.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="section-padding min-h-[70vh] max-w-[1200px] mx-auto">
      <SectionHeader title="Checkout" subtitle="Review your order and place it securely." />

      {cartItems.length === 0 ? (
        <div className="mt-12 rounded-xl border border-brand-divider bg-white p-10 text-center">
          <p className="text-xl font-semibold">Your cart is empty.</p>
          <p className="mt-4 text-brand-secondary">Add products to continue to checkout.</p>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6 rounded-3xl border border-brand-divider bg-white p-8">
            <h2 className="text-3xl font-display">Order details</h2>
            <div className="space-y-4">
              {cartItems.map((item) => (
                <div key={`${item.product.id}-${item.size || "default"}`} className="rounded-3xl border border-brand-divider p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
                    <div>
                      <p className="font-semibold">{item.product.title || item.product.name}</p>
                      {item.size && <p className="text-sm text-brand-secondary">Size: {item.size}</p>}
                      <p className="text-sm text-brand-secondary">Quantity: {item.quantity}</p>
                    </div>
                    <p className="font-semibold">{formatCurrency(item.product.price * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6 rounded-3xl border border-brand-divider bg-white p-8">
            <div className="space-y-2">
              <h2 className="text-3xl font-display">Summary</h2>
              <p className="text-brand-secondary">Confirm your order total and complete checkout.</p>
            </div>

            <div className="rounded-3xl bg-brand-surface p-6">
              <div className="flex items-center justify-between text-sm text-brand-secondary">
                <span>Subtotal</span>
                <span>{formatCurrency(cartSubtotal)}</span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-brand-divider pt-4 text-xl font-semibold">
                <span>Total</span>
                <span>{formatCurrency(cartSubtotal)}</span>
              </div>
            </div>

            {error && <div className="rounded-3xl bg-red-50 border border-red-100 p-4 text-sm text-red-700">{error}</div>}

            <button
              type="button"
              onClick={handlePlaceOrder}
              disabled={isSubmitting}
              className="btn-primary w-full px-6 py-4 text-lg font-semibold"
            >
              {isSubmitting ? "Placing order..." : "Place order"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
