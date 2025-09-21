import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import { db, auth } from '../services/firebase';
import { useNotification } from './NotificationContext';

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
  const { showNotification } = useNotification();

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: firebase.Unsubscribe = () => {};

    const setupAuth = async () => {
        try {
            // Set persistence to LOCAL storage to keep users logged in between sessions.
            await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        } catch (error) {
            console.error("Could not set auth persistence to local", error);
            showNotification({ message: 'Could not enable persistent login. You may be logged out when you close the tab.', type: 'error' });
        }

        unsubscribe = auth.onAuthStateChanged(async (firebaseUser: firebase.User | null) => {
            if (!isMounted) return;
    
            try {
                if (firebaseUser) {
                const userRef = db.doc(`users/${firebaseUser.uid}/profile/main`);
                const userDoc = await userRef.get();
    
                if (!userDoc.exists) {
                    let finalName = 'New User';
                    if (firebaseUser.displayName?.trim()) {
                        finalName = firebaseUser.displayName.trim();
                    }
                    const newUser: User = {
                    id: firebaseUser.uid,
                    name: finalName,
                    email: firebaseUser.email,
                    picture: firebaseUser.photoURL,
                    plan: 'free'
                    };
                    await userRef.set(newUser, { merge: true });
                    if (isMounted) {
                        setUser(newUser);
                        showNotification({ message: `Welcome, ${finalName}!`, type: 'success' });
                    }
                } else {
                    const profileData = userDoc.data();
                    setUser({
                    id: firebaseUser.uid,
                    name: profileData?.name || 'User',
                    email: firebaseUser.email,
                    picture: firebaseUser.photoURL,
                    plan: profileData?.plan === 'paid' ? 'paid' : 'free',
                    });
                }
                } else {
                if (isMounted) setUser(null);
                }
            } catch (error) {
                console.error("Error handling user session:", error);
                showNotification({ message: 'Could not load your profile data. Functionality may be limited.', type: 'error' });
                // Create a fallback user if firebaseUser exists, otherwise set to null
                if (isMounted && firebaseUser) {
                setUser({
                    id: firebaseUser.uid,
                    name: firebaseUser.displayName || 'User',
                    email: firebaseUser.email,
                    picture: firebaseUser.photoURL,
                    plan: 'free'
                });
                } else if (isMounted) {
                    setUser(null);
                }
            } finally {
                if (isMounted) {
                setLoading(false);
                }
            }
        });
    };
    
    setupAuth();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [showNotification]);

  const updateUserProfile = async (updates: Partial<User>) => {
      if (!user) return;
      
      const originalUser = { ...user };
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);

      try {
          const userRef = db.doc(`users/${user.id}/profile/main`);
          await userRef.update(updates);
          showNotification({ message: 'Profile updated successfully.', type: 'success' });
      } catch (error) {
          showNotification({ message: 'Could not save changes. Please try again.', type: 'error' });
          setUser(originalUser); // Revert on failure
      }
  };

  const deleteUserAccount = async () => {
      if (!user) return;
      
      const deleteCollection = async (collectionPath: string) => {
          const collectionRef = db.collection(collectionPath);
          const snapshot = await collectionRef.get();
          const batch = db.batch();
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

          await db.doc(`users/${user.id}/profile/main`).delete();
          await auth.signOut();
          setUser(null);
          showNotification({ message: 'Account deleted successfully.', type: 'success' });
      } catch (error) {
          showNotification({ message: 'Error deleting account data.', type: 'error' });
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