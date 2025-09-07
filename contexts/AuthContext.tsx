import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut } from 'firebase/auth';
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        if (firebaseUser) {
          const userRef = doc(db, `users/${firebaseUser.uid}/profile/main`);
          const userDoc = await getDoc(userRef);

          if (!userDoc.exists()) {
            // First time sign-in, create a profile document
            const newUser: User = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'New User',
              email: firebaseUser.email,
              picture: firebaseUser.photoURL,
              plan: 'free'
            };
            await setDoc(userRef, newUser);
            setUser(newUser);
          } else {
            // Existing user, merge auth data with profile data
            const profileData = userDoc.data() as User;
            setUser({
              ...profileData,
              // Keep auth provider data fresh
              email: firebaseUser.email,
              picture: firebaseUser.photoURL,
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

  const updateUserProfile = useCallback(async (updates: Partial<User>) => {
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
  }, [user]);

  const deleteUserAccount = useCallback(async () => {
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
          await signOut(auth);
          setUser(null);

      } catch (error) {
          console.error("Error deleting user account data:", error);
          throw error;
      }
  }, [user]);

  const value = useMemo(() => ({
    user,
    loading,
    updateUserProfile,
    deleteUserAccount
  }), [user, loading, updateUserProfile, deleteUserAccount]);


  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);