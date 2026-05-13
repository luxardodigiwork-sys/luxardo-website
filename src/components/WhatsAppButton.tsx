import React from "react";
import { whatsappLink } from "../constants/businessConfig";

const MSG = "Hi LUXARDO FASHION, I want to inquire about your products.";

export default function WhatsAppButton() {
  const link = whatsappLink(MSG);
  return React.createElement(
    "a",
    {
      href: link,
      target: "_blank",
      rel: "noopener noreferrer",
      "aria-label": "Chat on WhatsApp",
      className: "fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-full shadow-2xl hover:scale-110 transition-transform duration-200 flex items-center justify-center",
      style: { width: "60px", height: "60px" }
    },
    React.createElement(
      "svg",
      { viewBox: "0 0 32 32", width: "28", height: "28", fill: "currentColor", "aria-hidden": "true" },
      React.createElement("path", { d: "M16.001 0C7.164 0 0 7.164 0 16c0 2.823.741 5.557 2.146 7.973L0 32l8.296-2.179A15.91 15.91 0 0 0 16 32c8.836 0 16-7.164 16-16S24.836 0 16 0zm0 29.4c-2.539 0-5.005-.683-7.151-1.974l-.513-.305-5.32 1.397 1.42-5.184-.334-.532A13.34 13.34 0 0 1 2.6 16c0-7.394 6.007-13.4 13.4-13.4S29.4 8.606 29.4 16s-6.006 13.4-13.399 13.4z" }),
      React.createElement("path", { d: "M23.339 18.852c-.401-.201-2.371-1.169-2.738-1.302-.367-.135-.634-.201-.901.2-.267.4-1.034 1.302-1.268 1.569-.234.267-.467.301-.868.1-.401-.2-1.692-.624-3.224-1.989-1.192-1.063-1.996-2.376-2.23-2.776-.234-.4-.025-.617.176-.817.18-.18.401-.467.601-.701.2-.234.267-.4.4-.667.134-.267.067-.5-.033-.701-.101-.2-.901-2.171-1.235-2.972-.325-.78-.655-.674-.901-.687-.234-.012-.501-.012-.768-.012s-.701.1-1.068.5c-.367.4-1.402 1.369-1.402 3.341 0 1.971 1.435 3.876 1.635 4.143.2.267 2.823 4.31 6.838 6.045.956.413 1.701.66 2.282.846.959.305 1.832.262 2.521.159.769-.115 2.371-.969 2.705-1.904.334-.935.334-1.736.234-1.904-.1-.167-.367-.267-.768-.467z" })
    )
  );
}
