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

// Initialize Firebase
const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);

// Get Auth and set persistence
export const auth = app.auth();

// Set auth persistence to 'local' for better cross-origin/incognito support
// This helps ensure the sign-in state is remembered after the Google sign-in popup.
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch((error) => {
    // This can happen in restricted environments like browser extensions.
    console.error("Firebase auth persistence error:", error.code, error.message);
  });

// Export a v9 modular Firestore instance
export const db = getFirestore(app);