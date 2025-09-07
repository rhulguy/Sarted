// FIX: Switch to firebase v8 compat library to resolve import errors for initializeApp and auth functions.
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAXsEQK4GEtFCKZfsEVFihlQedivNWGzbc",
  authDomain: "swapmoo-e2b68.firebaseapp.com",
  projectId: "swapmoo-e2b68",
  messagingSenderId: "116829841158",
  appId: "1:116829841158:web:4afdd2b00706541c3ba087"
};

// Initialize Firebase
// FIX: Use v8 compat initialization. Check for existing apps.
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}


// Initialize Firebase services using the v9 modular API.
// FIX: Export v8 compat auth service.
export const auth = firebase.auth();
// FIX: Get Firestore instance for the default app. It will work with v9 modular functions.
export const db = getFirestore();
