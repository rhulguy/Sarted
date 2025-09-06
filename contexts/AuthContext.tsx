import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { Project, Habit, Resource, InboxTask, ProjectGroup } from '../types';

// Inform TypeScript that `firebase` exists on the global scope and its types are available.
declare const firebase: any;

export interface User {
  id: string;
  name: string;
  email: string | null;
  picture: string | null;
  plan: 'free' | 'paid';
}

interface FirebaseUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
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
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const userRef = db.doc(`users/${firebaseUser.uid}/profile/main`);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
          // First time sign-in, create a profile document
          const newUser: User = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'New User',
            email: firebaseUser.email,
            picture: firebaseUser.photoURL,
            plan: 'free'
          };
          await userRef.set(newUser);
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
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateUserProfile = async (updates: Partial<User>) => {
      if (!user) return;
      
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser); // Optimistic update

      try {
          const userRef = db.doc(`users/${user.id}/profile/main`);
          await userRef.update(updates);
      } catch (error) {
          console.error("Failed to update user profile:", error);
          setUser(user); // Revert on failure
          alert("Could not save changes. Please try again.");
      }
  };

  const deleteUserAccount = async () => {
      if (!user) return;
      
      // A helper function to delete all documents in a collection
      const deleteCollection = async (collectionPath: string) => {
          const collectionRef = db.collection(collectionPath);
          const snapshot = await collectionRef.get();
          const batch = db.batch();
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
      }

      try {
          // Delete all user data subcollections
          await Promise.all([
              deleteCollection(`users/${user.id}/projects`),
              deleteCollection(`users/${user.id}/projectGroups`),
              deleteCollection(`users/${user.id}/habits`),
              deleteCollection(`users/${user.id}/inbox`),
              deleteCollection(`users/${user.id}/resources`),
              deleteCollection(`users/${user.id}/settings`),
          ]);

          // Delete the main profile document
          await db.doc(`users/${user.id}/profile/main`).delete();

          // Finally sign out (deleting the auth user is more complex and requires re-auth)
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
