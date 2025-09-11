import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { Habit } from '../types';
import { useAuth } from './AuthContext';
import { db } from '../services/firebase';
import { INITIAL_HABITS } from '../constants';
import useLocalStorage from '../hooks/useLocalStorage';
import { useNotification } from './NotificationContext';

interface HabitContextType {
  habits: Habit[];
  loading: boolean;
  addHabit: (habit: Omit<Habit, 'id'>) => Promise<void>;
  updateHabit: (habit: Habit) => Promise<void>;
  deleteHabit: (habitId: string) => Promise<void>;
  importAndOverwriteHabits: (data: { habits: Habit[] }) => Promise<void>;
}

export const HabitContext = createContext<HabitContextType | undefined>(undefined);

export const HabitProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { showNotification } = useNotification();
  const [localHabits, setLocalHabits] = useLocalStorage<Habit[]>('sarted-anonymous-habits', INITIAL_HABITS);
  const [firebaseHabits, setFirebaseHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);

  const habits = useMemo(() => user ? firebaseHabits : localHabits, [user, firebaseHabits, localHabits]);
  const setHabits = useMemo(() => user ? setFirebaseHabits : setLocalHabits, [user]);

  useEffect(() => {
    if (authLoading) {
      setFirebaseHabits([]);
      setLoading(true);
      return;
    }
    if (user) {
      setLoading(true);
      const habitsRef = db.collection(`users/${user.id}/habits`);
      habitsRef.limit(1).get().then(snapshot => {
          if (snapshot.empty) {
              const batch = db.batch();
              INITIAL_HABITS.forEach(habit => batch.set(db.doc(`users/${user.id}/habits/${habit.id}`), habit));
              batch.commit().catch(err => showNotification({ message: 'Failed to seed initial habits.', type: 'error'}));
          }
      });
      
      const habitsQuery = db.collection(`users/${user.id}/habits`);
      const unsubscribe = habitsQuery.onSnapshot((snapshot) => {
        const userHabits = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Habit));
        setFirebaseHabits(userHabits);
        setLoading(false);
      }, (error) => {
          showNotification({ message: 'Error fetching habits.', type: 'error'});
          setLoading(false);
      });
      
      return () => unsubscribe();
    } else {
        setLoading(false);
    }
  }, [user, authLoading, showNotification]);

  const addHabit = useCallback(async (habitData: Omit<Habit, 'id'>) => {
    const newHabit: Habit = { ...habitData, id: `habit-${Date.now()}` };
    if (user) {
      try {
        await db.doc(`users/${user.id}/habits/${newHabit.id}`).set(newHabit);
        showNotification({ message: `Habit "${newHabit.name}" created.`, type: 'success' });
      } catch (error) {
        showNotification({ message: "Failed to add habit.", type: 'error' });
      }
    } else {
        setHabits(prev => [...prev, newHabit]);
    }
  }, [user, setHabits, showNotification]);

  const updateHabit = useCallback(async (habit: Habit) => {
    if (user) {
      try {
        await db.doc(`users/${user.id}/habits/${habit.id}`).set(habit);
      } catch (error) {
        showNotification({ message: 'Failed to save habit changes.', type: 'error' });
      }
    } else {
        setHabits(prev => prev.map(h => h.id === habit.id ? habit : h));
    }
  }, [user, setHabits, showNotification]);

  const deleteHabit = useCallback(async (habitId: string) => {
    if (user) {
      try {
        await db.doc(`users/${user.id}/habits/${habitId}`).delete();
        showNotification({ message: 'Habit deleted.', type: 'success' });
      } catch (error) {
        showNotification({ message: 'Failed to delete habit.', type: 'error' });
      }
    } else {
        setHabits(prev => prev.filter(h => h.id !== habitId));
    }
  }, [user, setHabits, showNotification]);

  const importAndOverwriteHabits = useCallback(async (data: { habits: Habit[] }) => {
    if (!user) return; 
    const CHUNK_SIZE = 400;
    const habitsRef = db.collection(`users/${user.id}/habits`);
    const snapshot = await habitsRef.get();
    
    for (let i = 0; i < snapshot.docs.length; i += CHUNK_SIZE) {
        const batch = db.batch();
        snapshot.docs.slice(i, i + CHUNK_SIZE).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }

    for (let i = 0; i < data.habits.length; i += CHUNK_SIZE) {
        const batch = db.batch();
        data.habits.slice(i, i + CHUNK_SIZE).forEach(habit => {
            batch.set(db.doc(`users/${user.id}/habits/${habit.id}`), habit);
        });
        await batch.commit();
    }
  }, [user]);

  const contextValue = useMemo(() => ({
    habits, loading, addHabit, updateHabit, deleteHabit, importAndOverwriteHabits
  }), [habits, loading, addHabit, updateHabit, deleteHabit, importAndOverwriteHabits]);

  return <HabitContext.Provider value={contextValue}>{children}</HabitContext.Provider>;
};

export const useHabit = (): HabitContextType => {
  const context = useContext(HabitContext);
  if (context === undefined) throw new Error('useHabit must be used within a HabitProvider');
  return context;
};