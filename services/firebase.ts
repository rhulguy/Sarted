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

// Initialize Firebase using the v8 compatibility API.
// This ensures the [DEFAULT] app is created correctly for the compat services.
// The v9 modular services will automatically discover this default app.
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}


// Initialize and export v9 modular Firestore (it will use the default app)
export const db = getFirestore();

// Initialize and export v8 compat Auth (it will use the default app)
export const auth = firebase.auth();

// Set auth persistence to 'local' for better cross-origin/incognito support
// This helps ensure the sign-in state is remembered after the Google sign-in popup.
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch((error) => {
    // This can happen in restricted environments like browser extensions.
    console.error("Firebase auth persistence error:", error.code, error.message);
  });