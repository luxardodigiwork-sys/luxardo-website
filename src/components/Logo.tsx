import React from 'react';

interface LogoProps {
  className?: string;
  dark?: boolean;
}

export default function Logo({ className = '', dark = false }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Luxardo"
      className={className}
      style={dark ? { filter: 'brightness(0) invert(1)' } : {}}
    />
  );
}
