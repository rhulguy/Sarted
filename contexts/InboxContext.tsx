import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { InboxTask } from '../types';
import { useAuth } from './AuthContext';
import { db } from '../services/firebase';

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
      const inboxQuery = db.collection(`users/${user.id}/inbox`).orderBy('createdAt', 'desc');
      const unsubscribe = inboxQuery.onSnapshot((snapshot) => {
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
    
    // Note: The final ID will be the one assigned by Firestore on the backend listener,
    // but we need a temporary, unique one for the optimistic UI update.
    const tempId = `inbox-${Date.now()}`;
    const newTask: InboxTask = {
        id: tempId,
        name: taskName.trim(),
        createdAt: Date.now(),
    };
    
    // Optimistic update for instant UI feedback
    setTasks(prev => [newTask, ...prev]);

    try {
        // Let Firestore generate the ID, but save the data.
        // The listener will pick up the "real" task from the server.
        // We use the tempId to ensure we can revert if needed.
        await db.collection(`users/${user.id}/inbox`).add({
            name: newTask.name,
            createdAt: newTask.createdAt
        });
    } catch(error) {
        console.error("Error adding task to inbox, reverting:", error);
        // Revert by removing the temporary task that failed to add
        setTasks(prev => prev.filter(t => t.id !== tempId)); 
    }
  }, [user]);

  const deleteTask = useCallback(async (taskId: string) => {
    if (!user) return;
    
    let originalTask: InboxTask | null = null;

    // Remove the task optimistically and capture it for a potential revert.
    setTasks(prev => {
      originalTask = prev.find(t => t.id === taskId) || null;
      return prev.filter(t => t.id !== taskId);
    });
    
    // If the task wasn't in the state, don't try to delete from DB.
    if (!originalTask) return;

    try {
        await db.doc(`users/${user.id}/inbox/${taskId}`).delete();
    } catch (error) {
        console.error("Error deleting task from inbox, reverting:", error);
        // Re-add the task that failed to be deleted.
        // This is a safe revert, though order might change until next DB sync.
        if (originalTask) {
            setTasks(prev => [...prev, originalTask]); 
        }
        alert("Failed to delete task. Please try again.");
    }
  }, [user]);

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