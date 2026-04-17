import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { AuthForm } from '../components/AuthForm';

export default function RegisterPage() {
  useEffect(() => {
    if ((window as any).lenis) {
      (window as any).lenis.scrollTo(0, { immediate: true });
    } else {
      window.scrollTo(0, 0);
    }
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-screen bg-brand-bg pt-32 pb-20 flex flex-col justify-center"
    >
      <AuthForm initialMode="signup" />
    </motion.div>
  );
}
