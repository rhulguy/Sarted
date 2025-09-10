import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { InboxTask } from '../types';
import { useAuth } from './AuthContext';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, deleteDoc, Timestamp, getDocs, writeBatch } from 'firebase/firestore';
import { useNotification } from './NotificationContext';

interface InboxState {
  tasks: InboxTask[];
  loading: boolean;
}

interface InboxContextType extends InboxState {
  addTask: (taskName: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  importAndOverwriteInbox: (data: { inboxTasks: InboxTask[] }) => Promise<void>;
}

const InboxContext = createContext<InboxContextType | undefined>(undefined);

export const InboxProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { showNotification } = useNotification();
  const [tasks, setTasks] = useState<InboxTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      setTasks([]);
      return;
    }

    if (user) {
      setLoading(true);
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
        setLoading(false);
      }, (error) => {
          showNotification({ message: 'Error fetching inbox tasks.', type: 'error' });
          setLoading(false);
      });
      return () => unsubscribe();
    } else {
      setTasks([]);
      setLoading(false);
    }
  }, [user, authLoading, showNotification]);

  const addTask = useCallback(async (taskName: string) => {
    if (!user || !taskName.trim()) {
        return;
    };
    
    try {
        await addDoc(collection(db, `users/${user.id}/inbox`), {
            name: taskName.trim(),
            createdAt: serverTimestamp()
        });
        showNotification({ message: `"${taskName}" added to Inbox.`, type: 'success' });
    } catch(error) {
        showNotification({ message: "Could not add task to Inbox.", type: 'error' });
    }
  }, [user, showNotification]);

  const deleteTask = useCallback(async (taskId: string) => {
    if (!user) return;
    
    try {
        await deleteDoc(doc(db, `users/${user.id}/inbox/${taskId}`));
    } catch (error) {
        showNotification({ message: 'Failed to delete task from Inbox.', type: 'error' });
    }
  }, [user, showNotification]);

  const importAndOverwriteInbox = useCallback(async (data: { inboxTasks: InboxTask[] }) => {
    if (!user) return;

    const CHUNK_SIZE = 400;
    const inboxRef = collection(db, `users/${user.id}/inbox`);
    const snapshot = await getDocs(inboxRef);
    
    for (let i = 0; i < snapshot.docs.length; i += CHUNK_SIZE) {
        const batch = writeBatch(db);
        snapshot.docs.slice(i, i + CHUNK_SIZE).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }

    const tasksWithTimestamps = data.inboxTasks.map(task => ({
        ...task,
        createdAt: Timestamp.fromMillis(task.createdAt),
    }));

    for (let i = 0; i < tasksWithTimestamps.length; i += CHUNK_SIZE) {
        const batch = writeBatch(db);
        tasksWithTimestamps.slice(i, i + CHUNK_SIZE).forEach(task => {
            const { id, ...taskData } = task;
            batch.set(doc(db, `users/${user.id}/inbox/${id}`), taskData);
        });
        await batch.commit();
    }
  }, [user]);

  const contextValue = useMemo(() => ({
    tasks,
    loading,
    addTask,
    deleteTask,
    importAndOverwriteInbox,
  }), [tasks, loading, addTask, deleteTask, importAndOverwriteInbox]);

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