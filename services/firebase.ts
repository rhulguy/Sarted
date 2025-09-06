


// This file now uses the globally available `firebase` object,
// which is loaded via script tags in `index.html`.

// Inform TypeScript that `firebase` exists on the global scope.
declare const firebase: any;

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAXsEQK4GEtFCKZfsEVFihlQedivNWGzbc",
  authDomain: "swapmoo-e2b68.firebaseapp.com",
  projectId: "swapmoo-e2b68",
  storageBucket: "swapmoo-e2b68.appspot.com",
  messagingSenderId: "116829841158",
  appId: "1:116829841158:web:4afdd2b00706541c3ba087"
};


// Initialize Firebase, but only if it hasn't been initialized already.
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Initialize Firebase services
export const auth = firebase.auth();
export const db = firebase.firestore();

// Analytics is initialized but not currently used elsewhere in the app.
const analytics = firebase.analytics();