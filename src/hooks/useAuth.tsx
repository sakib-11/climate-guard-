// C:\Users\DELL\Desktop\eco-lens-climate\src\hooks\useAuth.tsx

import { useEffect, useState } from "react";
import { 
  User, 
  onAuthStateChanged, 
  signOut as firebaseSignOut, 
} from "firebase/auth"; 

// ⬅️ CORRECTED IMPORT PATH: Go up one directory (to 'src'), then into 'firebase'
import { auth } from "../pages/firebase/firebase"; 
import { useNavigate } from "react-router-dom";
import { toast } from "sonner"; // Assuming you have toast imported elsewhere in your full file

// ... rest of your useAuth hook code ...

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null); 
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser); 
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth); 
      navigate('/auth'); 
      toast.info("You have been signed out.");
    } catch (error) {
        console.error("Firebase Sign Out Error:", error);
        toast.error("Failed to sign out.");
    }
  };

  return {
    user,
    loading,
    signOut,
    isAuthenticated: !!user,
  };
};