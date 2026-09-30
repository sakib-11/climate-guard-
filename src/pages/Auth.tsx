import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  updateProfile,
  setPersistence,
  browserSessionPersistence,
} from "firebase/auth";

import { auth } from "./firebase/firebase";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Leaf, Mail, Lock, User, AlertCircle, Sparkles } from "lucide-react";

import { toast } from "sonner";
import { z } from "zod";

// --- Zod Schema for Validation ---
const authSchema = z.object({
  email: z.string().trim().email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  username: z
    .string()
    .trim()
    .min(3, { message: "Username must be at least 3 characters." })
    .optional(),
});

type AuthFormData = z.infer<typeof authSchema>;

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Redirect if already signed in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate("/", { replace: true });
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Form Submission Handler
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setLoading(true);

    try {
      const validationData: Partial<AuthFormData> = {
        email: email.trim(),
        password,
      };
      if (!isLogin) {
        validationData.username = username.trim();
      }

      authSchema.parse(validationData);

      // Attempt session persistence safely without crashing on failure
      try {
        await setPersistence(auth, browserSessionPersistence);
      } catch (persistErr) {
        console.warn("Session persistence warning:", persistErr);
      }

      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        toast.success(
          `Welcome back, ${userCredential.user.displayName || userCredential.user.email}!`
        );
        navigate("/", { replace: true });
      } else {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

        if (username.trim()) {
          await updateProfile(userCredential.user, {
            displayName: username.trim(),
          });
        }

        toast.success("Account created! Welcome to ClimateGuard.");
        navigate("/", { replace: true });
      }
    } catch (error: any) {
      let errorMessage = "An authentication error occurred.";

      if (error instanceof z.ZodError) {
        errorMessage = error.errors[0]?.message || "Invalid form data.";
      } else if (error?.code) {
        switch (error.code) {
          case "auth/user-not-found":
          case "auth/wrong-password":
          case "auth/invalid-credential":
            errorMessage =
              "Invalid email or password. If you do not have an account, click 'Create Account' above.";
            break;
          case "auth/email-already-in-use":
            errorMessage =
              "This email is already registered. Please sign in instead.";
            break;
          case "auth/weak-password":
            errorMessage = "Password should be at least 6 characters.";
            break;
          case "auth/invalid-email":
            errorMessage = "Please enter a valid email address.";
            break;
          case "auth/network-request-failed":
            errorMessage = "Network error. Please check your internet connection.";
            break;
          case "auth/too-many-requests":
            errorMessage =
              "Too many attempts. Access temporarily blocked. Please wait or reset password.";
            break;
          default:
            errorMessage = error.message || "Authentication failed.";
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      setFormError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Quick 1-Click Demo Login
  const handleDemoLogin = async () => {
    setFormError(null);
    setLoading(true);
    setEmail("demo@climateguard.io");
    setPassword("climate123");

    try {
      try {
        await setPersistence(auth, browserSessionPersistence);
      } catch (persistErr) {
        console.warn("Session persistence warning:", persistErr);
      }

      const userCredential = await signInWithEmailAndPassword(
        auth,
        "demo@climateguard.io",
        "climate123"
      );
      toast.success(
        `Welcome to ClimateGuard, ${userCredential.user.displayName || userCredential.user.email}!`
      );
      navigate("/", { replace: true });
    } catch (error: any) {
      const msg = error?.message || "Demo login failed.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background px-6 py-12">
      <Card className="w-full max-w-md p-8 bg-card border-border rounded-2xl shadow-[var(--shadow-soft)]">
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Leaf className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold tracking-tight text-foreground">
              ClimateGuard
            </span>
          </div>
          <h2 className="text-xl font-bold text-foreground">
            {isLogin ? "Welcome Back" : "Create Your Account"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            {isLogin
              ? "Sign in to access your climate risk dashboard"
              : "Join ClimateGuard to track and predict climate risks"}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-xl mb-6">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setFormError(null);
            }}
            className={`py-2 text-sm font-semibold rounded-lg transition-all ${
              isLogin
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setFormError(null);
            }}
            className={`py-2 text-sm font-semibold rounded-lg transition-all ${
              !isLogin
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Visual Error Banner */}
        {formError && (
          <div className="mb-4 p-3.5 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-destructive" />
            <div className="flex-1 leading-snug">{formError}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-foreground text-sm font-medium">
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9"
                  required={!isLogin}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-foreground text-sm font-medium">
              Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-foreground text-sm font-medium">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 mt-2"
            disabled={loading}
          >
            {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
          </Button>
        </form>

        {/* 1-Click Demo Login */}
        <div className="mt-5">
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wider">
              <span className="bg-card px-2 text-muted-foreground font-medium">
                Quick Access
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full border-primary/30 hover:bg-primary/10 text-primary font-medium flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            1-Click Demo Login
          </Button>
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setFormError(null);
            }}
            className="text-primary hover:underline text-sm font-medium"
          >
            {isLogin
              ? "Don't have an account? Create one"
              : "Already have an account? Sign in"}
          </button>
        </div>

        <div className="mt-6 text-center">
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
