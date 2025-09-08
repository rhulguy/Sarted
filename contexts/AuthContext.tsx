import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
// FIX: Import firebase v8 compat library and remove modular auth imports to fix missing member errors.
import firebase from 'firebase/compat/app';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { Project, Habit, Resource, InboxTask, ProjectGroup } from '../types';

export interface User {
  id: string;
  name: string;
  email: string | null;
  picture: string | null;
  plan: 'free' | 'paid';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  updateUserProfile: (updates: Partial<User>) => Promise<void>;
  deleteUserAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  updateUserProfile: async () => {},
  deleteUserAccount: async () => {},
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // FIX: Use v8 compat syntax for onAuthStateChanged and User type.
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser: firebase.User | null) => {
      try {
        if (firebaseUser) {
          const userRef = doc(db, `users/${firebaseUser.uid}/profile/main`);
          const userDoc = await getDoc(userRef);

          if (!userDoc.exists()) {
            // First time sign-in, create a profile document
            let finalName = 'New User';
            if (firebaseUser.displayName && typeof firebaseUser.displayName === 'string' && firebaseUser.displayName.trim()) {
                finalName = firebaseUser.displayName.trim();
            }
            const newUser: User = {
              id: firebaseUser.uid,
              name: finalName,
              email: (firebaseUser.email && typeof firebaseUser.email === 'string') ? firebaseUser.email : null,
              picture: (firebaseUser.photoURL && typeof firebaseUser.photoURL === 'string') ? firebaseUser.photoURL : null,
              plan: 'free'
            };
            await setDoc(userRef, newUser);
            setUser(newUser);
          } else {
            // Existing user, robustly create user object
            const profileData = userDoc.data();
            
            let finalName = 'User'; // Start with a safe default
            if (profileData && typeof profileData.name === 'string' && profileData.name.trim()) {
                finalName = profileData.name.trim();
            } else if (firebaseUser.displayName && typeof firebaseUser.displayName === 'string' && firebaseUser.displayName.trim()) {
                finalName = firebaseUser.displayName.trim();
            }

            setUser({
              id: firebaseUser.uid,
              name: finalName,
              email: (firebaseUser.email && typeof firebaseUser.email === 'string') ? firebaseUser.email : null,
              picture: (firebaseUser.photoURL && typeof firebaseUser.photoURL === 'string') ? firebaseUser.photoURL : null,
              plan: (profileData && profileData.plan === 'paid') ? 'paid' : 'free',
            });
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Error during authentication state change:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const updateUserProfile = async (updates: Partial<User>) => {
      if (!user) return;
      
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser); // Optimistic update

      try {
          const userRef = doc(db, `users/${user.id}/profile/main`);
          await updateDoc(userRef, updates);
      } catch (error) {
          console.error("Failed to update user profile:", error);
          setUser(user); // Revert on failure
          alert("Could not save changes. Please try again.");
      }
  };

  const deleteUserAccount = async () => {
      if (!user) return;
      
      const deleteCollection = async (collectionPath: string) => {
          const collectionRef = collection(db, collectionPath);
          const snapshot = await getDocs(collectionRef);
          const batch = writeBatch(db);
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
      }

      try {
          await Promise.all([
              deleteCollection(`users/${user.id}/projects`),
              deleteCollection(`users/${user.id}/projectGroups`),
              deleteCollection(`users/${user.id}/habits`),
              deleteCollection(`users/${user.id}/inbox`),
              deleteCollection(`users/${user.id}/resources`),
              deleteCollection(`users/${user.id}/settings`),
          ]);

          await deleteDoc(doc(db, `users/${user.id}/profile/main`));
          // FIX: Use v8 compat syntax for signOut.
          await auth.signOut();
          setUser(null);

      } catch (error) {
          console.error("Error deleting user account data:", error);
          throw error;
      }
  };


  return (
    <AuthContext.Provider value={{ user, loading, updateUserProfile, deleteUserAccount }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);