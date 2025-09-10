import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAXsEQK4GEtFCKZfsEVFihlQedivNWGzbc",
  authDomain: "swapmoo-e2b68.firebaseapp.com",
  projectId: "swapmoo-e2b68",
  messagingSenderId: "116829841158",
  appId: "1:116829841158:web:4afdd2b00706541c3ba087"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Firestore and Auth services
export const db = getFirestore(app);
export const auth = getAuth(app);

// Set auth persistence to 'local' for better cross-origin/incognito support
// This helps ensure the sign-in state is remembered after the Google sign-in popup.
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    // This can happen in restricted environments like browser extensions.
    console.error("Firebase auth persistence error:", error.code, error.message);
  });