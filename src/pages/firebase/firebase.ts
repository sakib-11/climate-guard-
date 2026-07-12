// Import the core functions needed from the Firebase SDK
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth"; // For Authentication
import { getFirestore } from "firebase/firestore"; // For Cloud Firestore (Database)
import { getStorage } from "firebase/storage"; // For Cloud Storage (Files/Media)

// 1. Your web app's Firebase configuration
// !! IMPORTANT: Replace these with your actual Firebase project settings !!
const firebaseConfig = {
  apiKey: "AIzaSyD6MUDMzYPuT-tZ6qs3OxssmoZa-Ilrldk", // Placeholder: Replace with your key
  authDomain: "climateguard-3c7c7.firebaseapp.com",
  projectId: "climateguard-3c7c7",
  storageBucket: "climateguard-3c7c7.firebasestorage.app",
  messagingSenderId: "921628297527",
  appId: "1:921628297527:web:cdcbf0fd7ef5e29a8072b2",
  measurementId: "G-R1LNG29344"
};

// 2. Initialize Firebase App
const app = initializeApp(firebaseConfig);

// 3. Initialize and Export Services
// Exporting the initialized services allows you to use them in any component.

// Analytics service (optional) - safely initialize it
let analyticsInstance = null;
isSupported().then((yes) => {
  if (yes) {
    analyticsInstance = getAnalytics(app);
  }
});
export const analytics = analyticsInstance;

// Authentication service
export const auth = getAuth(app);

// Firestore Database service
export const db = getFirestore(app);

// Cloud Storage service
export const storage = getStorage(app);

// Export the primary app instance as the default export
export default app;