import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
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
            const profileData = userDoc.data() as User;
            setUser({
              ...profileData,
              email: firebaseUser.email,
              picture: firebaseUser.photoURL,
            });
          } else {
            // DATA LOSS FIX: This is a new user, create their profile and seed all initial data here, only once.
            const newUser: User = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'New User',
              email: firebaseUser.email,
              picture: firebaseUser.photoURL,
              plan: 'free',
            };
            await setDoc(userRef, newUser);

            // Seed initial data safely, only once on creation
            console.log("New user detected, seeding initial data...");
            const batch = writeBatch(db);
            INITIAL_PROJECT_GROUPS.forEach(group => {
                const groupRef = doc(db, `users/${firebaseUser.uid}/projectGroups`, group.id);
                batch.set(groupRef, group);
            });
            INITIAL_PROJECTS.forEach(project => {
                const projectRef = doc(db, `users/${firebaseUser.uid}/projects`, project.id);
                batch.set(projectRef, project);
            });
            INITIAL_RESOURCES.forEach(resource => {
                const resourceRef = doc(db, `users/${firebaseUser.uid}/resources`, resource.id);
                batch.set(resourceRef, resource);
            });
            INITIAL_HABITS.forEach(habit => {
                const habitRef = doc(db, `users/${firebaseUser.uid}/habits`, habit.id);
                batch.set(habitRef, habit);
            });
            await batch.commit();
            console.log("Initial data seeded successfully.");
            
            setUser(newUser);
          }
        } catch (error) {
          console.error("Firestore error getting/creating user profile. Using fallback data from auth provider.", error);
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