import { getFirestore } from "firebase/firestore";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAXsEQK4GEtFCKZfsEVFihlQedivNWGzbc",
  authDomain: "swapmoo-e2b68.firebaseapp.com",
  projectId: "swapmoo-e2b68",
  messagingSenderId: "116829841158",
  appId: "1:116829841158:web:4afdd2b00706541c3ba087"
};

// Initialize using the v8 compat API.
// This creates the default app instance that both v8 compat services (like auth)
// and v9 modular services (like getFirestore) can automatically discover.
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Get the v9 Firestore service. It automatically uses the default app initialized above.
export const db = getFirestore();

// Get the v8 Auth service. It also automatically uses the default app.
export const auth = firebase.auth();

// Set auth persistence to 'local' for better cross-origin/incognito support
// This helps ensure the sign-in state is remembered after the Google sign-in popup.
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch((error) => {
    // This can happen in restricted environments like browser extensions.
    console.error("Firebase auth persistence error:", error.code, error.message);
  });