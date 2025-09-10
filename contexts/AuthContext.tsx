import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        if (firebaseUser) {
          const userRef = doc(db, `users/${firebaseUser.uid}/profile/main`);
          const userDoc = await getDoc(userRef);

          if (!userDoc.exists()) {
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
            const profileData = userDoc.data();
            
            let finalName = 'User'; 
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
        showNotification({ message: 'Error during authentication.', type: 'error' });
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [showNotification]);

  const updateUserProfile = async (updates: Partial<User>) => {
      if (!user) return;
      
      const originalUser = { ...user };
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);

      try {
          const userRef = doc(db, `users/${user.id}/profile/main`);
          await updateDoc(userRef, updates);
          showNotification({ message: 'Profile updated successfully.', type: 'success' });
      } catch (error) {
          showNotification({ message: 'Could not save changes. Please try again.', type: 'error' });
          setUser(originalUser); // Revert on failure
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
          await signOut(auth);
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