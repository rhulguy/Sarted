import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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
const app = initializeApp(firebaseConfig);

// Initialize Firebase services using the v9 modular API.
export const auth = getAuth(app);
export const db = getFirestore(app);