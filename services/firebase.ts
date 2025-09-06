// FIX: Switched to Firebase v8 compat imports and initialization to resolve module export errors.
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAXsEQK4GEtFCKZfsEVFihlQedivNWGzbc",
  authDomain: "swapmoo-e2b68.firebaseapp.com",
  projectId: "swapmoo-e2b68",
  messagingSenderId: "116829841158",
  appId: "1:116829841158:web:4afdd2b00706541c3ba087"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Initialize Firebase services using the v8/compat namespaced API.
export const auth = firebase.auth();
export const db = firebase.firestore();
