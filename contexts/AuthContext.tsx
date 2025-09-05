import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { auth } from '../services/firebase';

// Inform TypeScript that `firebase` exists on the global scope and its types are available.
declare const firebase: any;

export interface User {
  id: string;
  name: string | null;
  email: string | null;
  picture: string | null;
}

// FIX: Define the shape of the Firebase user object locally to avoid issues
// with global type resolution for `firebase.User`.
interface FirebaseUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // The firebaseUser object is typed from the global firebase namespace
    const unsubscribe = auth.onAuthStateChanged((firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        setUser({
          id: firebaseUser.uid,
          name: firebaseUser.displayName,
          email: firebaseUser.email,
          picture: firebaseUser.photoURL,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);