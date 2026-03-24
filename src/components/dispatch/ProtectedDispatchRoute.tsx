import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { storage } from '../../utils/localStorage';

export default function ProtectedDispatchRoute() {
  const isDispatchAuth = localStorage.getItem('luxardo_dispatch_auth') === 'true';
  const dispatchUserStr = localStorage.getItem('luxardo_dispatch_user');
  
  if (!isDispatchAuth || !dispatchUserStr) {
    if (isDispatchAuth) localStorage.removeItem('luxardo_dispatch_auth');
    return <Navigate to="/backend" replace />;
  }

  let storedUser;
  try {
    storedUser = JSON.parse(dispatchUserStr);
  } catch (e) {
    localStorage.removeItem('luxardo_dispatch_auth');
    localStorage.removeItem('luxardo_dispatch_user');
    return <Navigate to="/backend" replace />;
  }

  const dispatchUsers = storage.getDispatchUsers();
  const currentUser = dispatchUsers.find(u => u.id === storedUser.id);

  if (!currentUser || currentUser.status === 'disabled') {
    // Clear auth if user was disabled or removed
    localStorage.removeItem('luxardo_dispatch_auth');
    localStorage.removeItem('luxardo_dispatch_user');
    return <Navigate to="/backend" replace />;
  }

  return <Outlet />;
}
