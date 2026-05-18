import React, { useEffect, useState } from "react";

const STORAGE_KEY = "luxardo_cookie_consent";

export default function CookieConsent() {
  const [show, setShow] = useState(false);
  
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) setShow(true);
  }, []);
  
  const accept = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: true, date: new Date().toISOString() }));
    setShow(false);
  };
  
  const reject = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: false, date: new Date().toISOString() }));
    setShow(false);
  };
  
  if (!show) return null;
  
  return React.createElement(
    "div",
    {
      className: "fixed bottom-0 left-0 right-0 z-50 bg-black text-white p-4 shadow-2xl border-t border-white/10",
      style: { fontFamily: "Georgia, serif" }
    },
    React.createElement(
      "div",
      { className: "max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4" },
      React.createElement(
        "div",
        { className: "flex-1" },
        React.createElement(
          "h3",
          { className: "text-sm uppercase tracking-widest font-bold mb-1" },
          "We Value Your Privacy"
        ),
        React.createElement(
          "p",
          { className: "text-xs text-white/70 leading-relaxed" },
          "We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking \"Accept\", you consent to our use of cookies. "
        ),
        React.createElement(
          "a",
          { href: "/policies/privacy", className: "text-xs text-white/90 underline hover:text-white" },
          "Learn more"
        )
      ),
      React.createElement(
        "div",
        { className: "flex gap-3 flex-shrink-0" },
        React.createElement(
          "button",
          {
            onClick: reject,
            className: "px-6 py-2 text-xs uppercase tracking-widest border border-white/30 hover:border-white text-white/70 hover:text-white transition-colors"
          },
          "Reject"
        ),
        React.createElement(
          "button",
          {
            onClick: accept,
            className: "px-6 py-2 text-xs uppercase tracking-widest bg-white text-black hover:bg-white/90 transition-colors"
          },
          "Accept"
        )
      )
    )
  );
}
