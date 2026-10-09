import React from 'react';

interface Animated3DHeaderProps {
  children: React.ReactNode;
}

/**
 * Pass-through wrapper.
 * Header shrinking is now handled natively by Layout.tsx via isScrolled state.
 * No 3D transforms (was causing header to appear to disappear).
 */
export default function Animated3DHeader({ children }: Animated3DHeaderProps) {
  return <>{children}</>;
}
