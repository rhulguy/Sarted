import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { Habit } from '../types';
import { useAuth } from './AuthContext';
import { db } from '../services/firebase';
import { collection, doc, getDocs, query, limit, writeBatch, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { INITIAL_HABITS } from '../constants';
import useLocalStorage from '../hooks/useLocalStorage';

interface HabitContextType {
  habits: Habit[];
  addHabit: (habit: Omit<Habit, 'id'>) => Promise<void>;
  updateHabit: (habit: Habit) => Promise<void>;
  deleteHabit: (habitId: string) => Promise<void>;
  importAndOverwriteHabits: (data: { habits: Habit[] }) => Promise<void>;
}

export const HabitContext = createContext<HabitContextType | undefined>(undefined);

export const HabitProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [localHabits, setLocalHabits] = useLocalStorage<Habit[]>('sarted-anonymous-habits', INITIAL_HABITS);
  const [firebaseHabits, setFirebaseHabits] = useState<Habit[]>([]);

  const habits = useMemo(() => user ? firebaseHabits : localHabits, [user, firebaseHabits, localHabits]);
  const setHabits = useMemo(() => user ? setFirebaseHabits : setLocalHabits, [user]);

  useEffect(() => {
    if (authLoading) {
      setFirebaseHabits([]);
      return;
    }
    if (user) {
      const habitsRef = collection(db, `users/${user.id}/habits`);
      getDocs(query(habitsRef, limit(1))).then(snapshot => {
          if (snapshot.empty) {
              console.log("New user habit collection is empty. Seeding initial data.");
              const batch = writeBatch(db);
              INITIAL_HABITS.forEach(habit => {
                  const habitRef = doc(db, `users/${user.id}/habits/${habit.id}`);
                  batch.set(habitRef, habit);
              });
              batch.commit().catch(err => console.error("Failed to seed habits:", err));
          }
      });
      
      const habitsQuery = collection(db, `users/${user.id}/habits`);
      const unsubscribe = onSnapshot(habitsQuery, (snapshot) => {
        const userHabits = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Habit));
        setFirebaseHabits(userHabits);
      }, (error) => console.error("Error fetching habits:", error));
      
      return () => unsubscribe();
    }
  }, [user, authLoading]);

  const addHabit = useCallback(async (habitData: Omit<Habit, 'id'>) => {
    const newHabit: Habit = { ...habitData, id: `habit-${Date.now()}` };
    
    setHabits(prev => [...prev, newHabit]);

    if (user) {
      try {
        await setDoc(doc(db, `users/${user.id}/habits/${newHabit.id}`), newHabit);
      } catch (error) {
        console.error("Failed to add habit, reverting:", error);
        setHabits(prev => prev.filter(h => h.id !== newHabit.id));
      }
    }
  }, [user, setHabits]);

  const updateHabit = useCallback(async (habit: Habit) => {
    const originalHabits = habits;
    setHabits(prev => prev.map(h => h.id === habit.id ? habit : h));

    if (user) {
      try {
        await setDoc(doc(db, `users/${user.id}/habits/${habit.id}`), habit);
      } catch (error) {
        console.error("Failed to update habit, reverting:", error);
        setHabits(originalHabits);
      }
    }
  }, [user, habits, setHabits]);

  const deleteHabit = useCallback(async (habitId: string) => {
    const originalHabits = habits;
    setHabits(prev => prev.filter(h => h.id !== habitId));
    
    if (user) {
      try {
        await deleteDoc(doc(db, `users/${user.id}/habits/${habitId}`));
      } catch (error) {
        console.error("Failed to delete habit, reverting:", error);
        setHabits(originalHabits);
      }
    }
  }, [user, habits, setHabits]);

  const importAndOverwriteHabits = useCallback(async (data: { habits: Habit[] }) => {
    if (!user) return; // For anonymous users, we don't do anything with Firebase

    const CHUNK_SIZE = 400;
    const habitsRef = collection(db, `users/${user.id}/habits`);
    const snapshot = await getDocs(habitsRef);
    
    // Delete existing habits in chunks
    for (let i = 0; i < snapshot.docs.length; i += CHUNK_SIZE) {
        const chunk = snapshot.docs.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }

    // Add new habits from backup in chunks
    for (let i = 0; i < data.habits.length; i += CHUNK_SIZE) {
        const chunk = data.habits.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(habit => {
            const newHabitRef = doc(db, `users/${user.id}/habits/${habit.id}`);
            batch.set(newHabitRef, habit);
        });
        await batch.commit();
    }
  }, [user]);

  const contextValue = useMemo(() => ({
    habits, addHabit, updateHabit, deleteHabit, importAndOverwriteHabits
  }), [habits, addHabit, updateHabit, deleteHabit, importAndOverwriteHabits]);

  return <HabitContext.Provider value={contextValue}>{children}</HabitContext.Provider>;
};

export const useHabit = (): HabitContextType => {
  const context = useContext(HabitContext);
  if (context === undefined) throw new Error('useHabit must be used within a HabitProvider');
  return context;
};