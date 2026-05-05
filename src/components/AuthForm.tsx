import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface AuthFormProps {
  initialMode?: string;
}

export function AuthForm({ initialMode }: AuthFormProps) {
  const navigate = useNavigate();

  useEffect(() => {
    // Popup khulte hi user ko seedha main Login page par bhej do
    navigate('/login');
  }, [navigate]);

  return (
    <div className="p-8 text-center text-brand-black">
      <p className="text-sm animate-pulse">Redirecting to secure login...</p>
    </div>
  );
}
