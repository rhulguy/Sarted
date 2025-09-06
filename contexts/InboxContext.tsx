import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { InboxTask } from '../types';
import { useAuth } from './AuthContext';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, deleteDoc, Timestamp } from 'firebase/firestore';

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
      const inboxQuery = query(collection(db, `users/${user.id}/inbox`), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(inboxQuery, (snapshot) => {
        const userTasks = snapshot.docs.map(d => {
            const data = d.data();
            const createdAtTimestamp = data.createdAt as Timestamp | null;
            return { 
                id: d.id,
                name: data.name,
                createdAt: createdAtTimestamp ? createdAtTimestamp.toMillis() : Date.now()
            } as InboxTask
        });
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
        await addDoc(collection(db, `users/${user.id}/inbox`), {
            name: taskName.trim(),
            createdAt: serverTimestamp()
        });
    } catch(error) {
        console.error("Error adding task to inbox:", error);
        alert("Could not add task. Please check your connection and try again.");
    }
  }, [user]);

  const deleteTask = useCallback(async (taskId: string) => {
    if (!user) return;
    
    try {
        await deleteDoc(doc(db, `users/${user.id}/inbox/${taskId}`));
    } catch (error) {
        console.error("Error deleting task from inbox:", error);
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