import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { InboxTask } from '../types';
import { useAuth } from './AuthContext';
import { db } from '../services/firebase';
import { collection, onSnapshot, doc, deleteDoc, query, addDoc } from 'firebase/firestore';

interface InboxState {
  tasks: InboxTask[];
}

interface InboxContextType extends InboxState {
  addTask: (taskName: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
}

const InboxContext = createContext<InboxContextType | undefined>(undefined);

export const InboxProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<InboxTask[]>([]);

  useEffect(() => {
    if (user) {
      const inboxQuery = query(collection(db, `users/${user.id}/inbox`));
      const unsubscribe = onSnapshot(inboxQuery, (snapshot) => {
        const userTasks = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as InboxTask));
        setTasks(userTasks);
      }, (error) => console.error("Error fetching inbox:", error));
      return () => unsubscribe();
    } else {
      setTasks([]);
    }
  }, [user]);

  const addTask = useCallback(async (taskName: string) => {
    if (!user || !taskName.trim()) {
        return;
    };
    try {
        // Let Firestore generate a unique ID for robustness
        await addDoc(collection(db, `users/${user.id}/inbox`), { name: taskName.trim() });
    } catch(error) {
        console.error("Error adding task to inbox:", error);
    }
  }, [user]);

  const deleteTask = useCallback(async (taskId: string) => {
    if (!user) return;
    
    // Optimistic update for better UX
    const originalTasks = tasks;
    setTasks(prev => prev.filter(t => t.id !== taskId));

    try {
        await deleteDoc(doc(db, `users/${user.id}/inbox`, taskId));
    } catch (error) {
        console.error("Error deleting task from inbox, reverting:", error);
        setTasks(originalTasks); // Revert
    }
  }, [user, tasks]);

  const contextValue = useMemo(() => ({
    tasks,
    addTask,
    deleteTask
  }), [tasks, addTask, deleteTask]);

  return (
    <InboxContext.Provider value={contextValue}>
      {children}
    </InboxContext.Provider>
  );
};

export const useInbox = (): InboxContextType => {
  const context = useContext(InboxContext);
  if (context === undefined) {
    throw new Error('useInbox must be used within a InboxProvider');
  }
  return context;
};