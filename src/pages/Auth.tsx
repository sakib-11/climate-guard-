// src/components/Auth.tsx

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  updateProfile,
  setPersistence, // <-- CRITICAL: Used to control session storage
  browserSessionPersistence, // <-- CRITICAL: Specifies session-only storage
} from "firebase/auth";

import { auth } from "./firebase/firebase";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Leaf, Mail, Lock, User } from "lucide-react";

import { toast } from "sonner";
import { z } from "zod";

// --- Zod Schema for Validation ---
const authSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  username: z
    .string()
    .trim()
    .min(3, { message: "Username must be at least 3 characters" })
    .optional(),
});

// Infer the type from the schema for type safety
type AuthFormData = z.infer<typeof authSchema>;

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  // --- Firebase Auth State Listener for Immediate Redirection ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in, redirect to the protected Index page
        navigate("/", { replace: true });
      }
    });

    return () => unsubscribe(); // Cleanup the listener on component unmount
  }, [navigate]);

  // --- Form Submission Handler ---
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Prepare data for validation
      let validationData: Partial<AuthFormData> = { email, password };
      if (!isLogin) {
        validationData.username = username;
      }

      authSchema.parse(validationData);

      if (isLogin) {
        // 1. Set persistence to session storage
        await setPersistence(auth, browserSessionPersistence);

        // 2. Perform Firebase Sign In
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        toast.success(
          `Welcome back, ${userCredential.user.displayName || userCredential.user.email}!`
        );
      } else {
        // 1. Set persistence for new user
        await setPersistence(auth, browserSessionPersistence);

        // 2. Perform Firebase Sign Up
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);

        // 3. Update the user's profile
        await updateProfile(userCredential.user, {
          displayName: username,
        });

        toast.success("Account created! Welcome to ClimateGuard.");
      }
    } catch (error: any) {
      // --- Error Handling ---
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error.code) {
        let errorMessage = "An authentication error occurred.";

        switch (error.code) {
          case "auth/user-not-found":
          case "auth/wrong-password":
          case "auth/invalid-credential":
            errorMessage = "Invalid email or password.";
            break;
          case "auth/email-already-in-use":
            errorMessage = "This email is already registered. Please sign in.";
            break;
          case "auth/weak-password":
            errorMessage = "Password must be at least 6 characters.";
            break;
          default:
            console.error("Firebase Auth Error:", error.message);
            errorMessage = error.message;
        }
        toast.error(errorMessage);
      } else {
        toast.error("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // --- Component Render ---
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background px-6">
      <Card className="w-full max-w-md p-8 bg-card border-border rounded-2xl shadow-[var(--shadow-soft)]">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Leaf className="w-8 h-8 text-primary" />
            <span className="text-2xl font-semibold text-foreground">ClimateGuard</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            {isLogin ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="text-muted-foreground mt-2 text-center">
            {isLogin
              ? "Sign in to access your climate risk dashboard"
              : "Join ClimateGuard to track and predict climate risks"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="username" className="text-foreground">
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10"
                  required={!isLogin}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={loading}
          >
            {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:underline text-sm"
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
