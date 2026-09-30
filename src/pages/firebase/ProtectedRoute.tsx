// C:\Users\DELL\Desktop\ClimateGuard\src\pages\firebase\ProtectedRoute.tsx

import React, { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';

// 🚨 CORRECTED IMPORT PATH: Now points to firebase.ts in the same directory
import { auth } from './firebase'; 

const ProtectedRoute: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // This listener checks the initial auth state and handles loading
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // If user exists, they are authenticated
      setIsAuthenticated(!!user);
    });

    return () => unsubscribe();
  }, []);

  // Show clean spinner while checking the Firebase status
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Authenticating ClimateGuard...</p>
        </div>
      </div>
    );
  }

  // If authenticated, render the nested route (<Outlet />)
  // If NOT authenticated, redirect to the login page (/auth)
  return isAuthenticated ? <Outlet /> : <Navigate to="/auth" replace />;
};

export default ProtectedRoute;