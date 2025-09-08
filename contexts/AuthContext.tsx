import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, writeBatch, deleteDoc, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { Project, Habit, Resource, InboxTask, ProjectGroup } from '../types';
import { INITIAL_PROJECT_GROUPS, INITIAL_PROJECTS, INITIAL_RESOURCES, INITIAL_HABITS } from '../constants';


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
      setLoading(true);
      if (firebaseUser) {
        try {
          const userRef = doc(db, `users/${firebaseUser.uid}/profile/main`);
          const userDoc = await getDoc(userRef);

          if (userDoc.exists()) {
            const profileData = userDoc.data();
            // Case 1: Returning user, already correctly initialized.
            if (profileData.initialDataSeeded) {
              console.log("Returning user with seeded flag detected.");
              setUser({
                id: firebaseUser.uid,
                name: profileData.name || firebaseUser.displayName || 'User',
                email: firebaseUser.email,
                picture: firebaseUser.photoURL,
                // FIX: Ensure plan is correctly typed as 'free' | 'paid'.
                plan: profileData.plan === 'paid' ? 'paid' : 'free',
              });
            } else {
              // Case 2: Legacy user. Profile exists but no seeded flag.
              // We assume their data exists and just add the flag to prevent future wipes.
              console.log("Legacy user detected. Adding seeded flag without overwriting data.");
              await updateDoc(userRef, { initialDataSeeded: true });
              setUser({
                 id: firebaseUser.uid,
                name: profileData.name || firebaseUser.displayName || 'User',
                email: firebaseUser.email,
                picture: firebaseUser.photoURL,
                // FIX: Ensure plan is correctly typed as 'free' | 'paid'.
                plan: profileData.plan === 'paid' ? 'paid' : 'free',
              });
            }
          } else {
            // Case 3: Brand new user. Profile does not exist.
            // This is the ONLY case where we seed data.
            console.log("Brand new user detected. Seeding initial data.");
            const batch = writeBatch(db);
            const newUserProfile = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'New User',
              plan: 'free',
              initialDataSeeded: true, // The critical flag
            };
            batch.set(userRef, newUserProfile);
            
            const collectionsToSeed = [
              { name: 'projectGroups', initialData: INITIAL_PROJECT_GROUPS },
              { name: 'projects', initialData: INITIAL_PROJECTS },
              { name: 'resources', initialData: INITIAL_RESOURCES },
              { name: 'habits', initialData: INITIAL_HABITS }
            ];

            for (const { name, initialData } of collectionsToSeed) {
                const collectionRef = collection(db, `users/${firebaseUser.uid}/${name}`);
                initialData.forEach((item: any) => {
                    if (item.id) {
                        const itemRef = doc(collectionRef, item.id);
                        batch.set(itemRef, item);
                    }
                });
            }

            await batch.commit();

            // FIX: The object passed to setUser must conform to the User interface.
            // Spreading newUserProfile included `initialDataSeeded`, which is not in the User type,
            // and `plan` was inferred as `string` instead of the literal `'free'`.
            setUser({
              id: newUserProfile.id,
              name: newUserProfile.name,
              plan: 'free',
              email: firebaseUser.email,
              picture: firebaseUser.photoURL,
            });
          }
        } catch (error) {
          console.error("Firestore error getting/creating user profile:", error);
          // Fallback to auth data if Firestore fails, ensures user stays logged in visually
          setUser({
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'User',
            email: firebaseUser.email,
            picture: firebaseUser.photoURL,
            plan: 'free',
          });
        } finally {
            setLoading(false);
        }
      } else {
        setUser(null);
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