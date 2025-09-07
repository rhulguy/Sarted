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

// Initialize the Firebase app and get the instance. This is a more robust
// pattern for hybrid v8/v9 usage as it avoids relying on the implicit "default" app.
const app = firebase.apps.length 
  ? firebase.app() 
  : firebase.initializeApp(firebaseConfig);


// Initialize and export services from the explicit app instance
export const db = getFirestore(app);
export const auth = app.auth();

// Set auth persistence to 'local' for better cross-origin/incognito support
// This helps ensure the sign-in state is remembered after the Google sign-in popup.
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch((error) => {
    // This can happen in restricted environments like browser extensions.
    console.error("Firebase auth persistence error:", error.code, error.message);
  });