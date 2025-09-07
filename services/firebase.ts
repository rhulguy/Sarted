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
// This is the key change to ensure the compat libraries are initialized correctly.
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Export a v9 modular Firestore instance. It will automatically use the default app
// initialized by the compat library.
export const db = getFirestore();

// Export a v8 compat auth instance, which is what the Auth context expects.
export const auth = firebase.auth();