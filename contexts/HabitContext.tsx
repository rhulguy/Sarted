import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { Habit } from '../types';
import { useAuth } from './AuthContext';
import { db } from '../services/firebase';
// FIX: Removed unused v9 modular imports. v8 API is used via the 'db' service.
import { INITIAL_HABITS } from '../constants';

interface HabitContextType {
  habits: Habit[];
  addHabit: (habit: Omit<Habit, 'id'>) => Promise<void>;
  updateHabit: (habit: Habit) => Promise<void>;
  deleteHabit: (habitId: string) => Promise<void>;
}

export const HabitContext = createContext<HabitContextType | undefined>(undefined);

export const HabitProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);

  // Seed initial data for new users
  useEffect(() => {
    if (user) {
      // FIX: Use v8 namespaced API for document access and batch writes.
      const userDocRef = db.doc(`users/${user.id}`);
      userDocRef.get().then(docSnap => {
        if (!docSnap.exists || !docSnap.data()?.habitSeeded) {
          const batch = db.batch();
          batch.set(userDocRef, { habitSeeded: true }, { merge: true });
          INITIAL_HABITS.forEach(habit => {
            const habitRef = db.doc(`users/${user.id}/habits/${habit.id}`);
            batch.set(habitRef, habit);
          });
          batch.commit();
        }
      });
    }
  }, [user]);

  // Listen for data changes from Firestore
  useEffect(() => {
    if (authLoading) {
      setHabits([]);
      return; // Wait for authentication to resolve
    }

    if (user) {
      // FIX: Use v8 namespaced API for collection queries and snapshots.
      const habitsQuery = db.collection(`users/${user.id}/habits`);
      const unsubscribe = habitsQuery.onSnapshot((snapshot) => {
        const userHabits = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Habit));
        setHabits(userHabits);
      }, (error) => console.error("Error fetching habits:", error));
      
      return () => unsubscribe();
    } else {
      setHabits(INITIAL_HABITS);
    }
  }, [user, authLoading]);

  const addHabit = useCallback(async (habitData: Omit<Habit, 'id'>) => {
    const newHabit: Habit = { ...habitData, id: `habit-${Date.now()}` };
    const originalHabits = habits;
    setHabits(prev => [...prev, newHabit]); // Optimistic update

    if (user) {
        try {
            // FIX: Use v8 namespaced API to set document data.
            await db.doc(`users/${user.id}/habits/${newHabit.id}`).set(newHabit);
        } catch (error) {
            console.error("Failed to add habit, reverting:", error);
            setHabits(originalHabits); // Revert
        }
    }
  }, [user, habits]);

  const updateHabit = useCallback(async (habit: Habit) => {
    const originalHabits = habits;
    setHabits(prev => prev.map(h => h.id === habit.id ? habit : h)); // Optimistic update
    
    if (user) {
        try {
            // FIX: Use v8 namespaced API to set document data.
            await db.doc(`users/${user.id}/habits/${habit.id}`).set(habit);
        } catch (error) {
            console.error("Failed to update habit, reverting:", error);
            setHabits(originalHabits); // Revert
        }
    }
  }, [user, habits]);

  const deleteHabit = useCallback(async (habitId: string) => {
    const originalHabits = habits;
    setHabits(prev => prev.filter(h => h.id !== habitId)); // Optimistic update

    if (user) {
        try {
            // FIX: Use v8 namespaced API to delete a document.
            await db.doc(`users/${user.id}/habits/${habitId}`).delete();
        } catch (error) {
            console.error("Failed to delete habit, reverting:", error);
            setHabits(originalHabits); // Revert
        }
    }
  }, [user, habits]);

  const contextValue = useMemo(() => ({
    habits, addHabit, updateHabit, deleteHabit
  }), [habits, addHabit, updateHabit, deleteHabit]);

  return <HabitContext.Provider value={contextValue}>{children}</HabitContext.Provider>;
};

export const useHabit = (): HabitContextType => {
  const context = useContext(HabitContext);
  if (context === undefined) throw new Error('useHabit must be used within a HabitProvider');
  return context;
};