// FIX: Use compat library for initialization to support older Firebase versions while maintaining v9 modular API for services.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import { getAuth } from "firebase/auth";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED 
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAXsEQK4GEtFCKZfsEVFihlQedivNWGzbc",
  authDomain: "swapmoo-e2b68.firebaseapp.com",
  projectId: "swapmoo-e2b68",
  storageBucket: "swapmoo-e2b68.appspot.com", // CRITICAL FIX: This was missing
  messagingSenderId: "116829841158",
  appId: "1:116829841158:web:4afdd2b00706541c3ba087"
};

// Initialize Firebase
// FIX: Use compat version of initializeApp.
const app = firebase.initializeApp(firebaseConfig);

// Initialize Firebase services using the v9 modular API.
export const auth = getAuth(app);

// PERFORMANCE FIX: Robust Firestore initialization to prevent connection timeouts
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
    tabManager: persistentMultipleTabManager()
  }),
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
});

export const storage = getStorage(app);