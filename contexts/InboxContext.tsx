import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { InboxTask } from '../types';
import { useAuth } from './AuthContext';
import { db } from '../services/firebase';
import firebase from 'firebase/compat/app';
import { useNotification } from './NotificationContext';
import useLocalStorage from '../hooks/useLocalStorage';

interface InboxState {
  tasks: InboxTask[];
  loading: boolean;
}

interface InboxContextType extends InboxState {
  addTask: (taskName: string) => Promise<void>;
  addMultipleTasks: (taskNames: string[]) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  importAndOverwriteInbox: (data: { inboxTasks: InboxTask[] }) => Promise<void>;
}

const InboxContext = createContext<InboxContextType | undefined>(undefined);

export const InboxProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { showNotification } = useNotification();

  const [firebaseTasks, setFirebaseTasks] = useState<InboxTask[]>([]);
  const [localTasks, setLocalTasks] = useLocalStorage<InboxTask[]>('sarted-anonymous-inbox', []);
  const [loading, setLoading] = useState(true);

  const tasks = useMemo(() => (user ? firebaseTasks : localTasks), [user, firebaseTasks, localTasks]);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      setFirebaseTasks([]);
      return;
    }

    if (user) {
      setLoading(true);
      const inboxQuery = db.collection(`users/${user.id}/inbox`).orderBy('createdAt', 'desc');
      const unsubscribe = inboxQuery.onSnapshot((snapshot) => {
        const userTasks = snapshot.docs.map(d => {
            const data = d.data();
            const createdAtTimestamp = data.createdAt as firebase.firestore.Timestamp | null;
            return { 
                id: d.id,
                name: data.name,
                createdAt: createdAtTimestamp ? createdAtTimestamp.toMillis() : Date.now()
            } as InboxTask
        });
        setFirebaseTasks(userTasks);
        setLoading(false);
      }, (error) => {
          showNotification({ message: 'Error fetching inbox tasks.', type: 'error' });
          setLoading(false);
      });
      return () => unsubscribe();
    } else {
      // For anonymous users, localTasks from useLocalStorage is the source of truth.
      setFirebaseTasks([]); // Clear any stale data from a previous session
      setLoading(false);
    }
  }, [user, authLoading, showNotification]);

  const addTask = useCallback(async (taskName: string) => {
    if (!taskName.trim()) return;

    if (user) {
        const tempId = `pending-${Date.now()}`;
        const pendingTask: InboxTask = {
            id: tempId,
            name: taskName.trim(),
            createdAt: Date.now(),
            isPending: true,
        };
        setFirebaseTasks(prev => [pendingTask, ...prev]);

        try {
            await db.collection(`users/${user.id}/inbox`).add({
                name: taskName.trim(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch(error) {
            showNotification({ message: "Could not add task. Please try again.", type: 'error' });
            setFirebaseTasks(prev => prev.filter(t => t.id !== tempId));
        }
    } else {
        const newTask: InboxTask = {
            id: `local-${Date.now()}`,
            name: taskName.trim(),
            createdAt: Date.now(),
        };
        setLocalTasks(prev => [newTask, ...prev]);
    }
  }, [user, showNotification, setLocalTasks]);
  
  const addMultipleTasks = useCallback(async (taskNames: string[]) => {
      const validTaskNames = taskNames.map(name => name.trim()).filter(Boolean);
      if (validTaskNames.length === 0) return;

      if (user) {
          try {
              const batch = db.batch();
              const inboxCollection = db.collection(`users/${user.id}/inbox`);
              validTaskNames.forEach(name => {
                  const newTaskRef = inboxCollection.doc();
                  batch.set(newTaskRef, { name, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
              });
              await batch.commit();
              showNotification({ message: `${validTaskNames.length} task(s) added to inbox.`, type: 'success' });
          } catch (error) {
              showNotification({ message: "Could not add tasks to Inbox.", type: 'error' });
          }
      } else {
          const newTasks: InboxTask[] = validTaskNames.map(name => ({
              id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name,
              createdAt: Date.now(),
          }));
          setLocalTasks(prev => [...newTasks, ...prev]);
          showNotification({ message: `${newTasks.length} task(s) added to inbox.`, type: 'success' });
      }
  }, [user, showNotification, setLocalTasks]);

  const deleteTask = useCallback(async (taskId: string) => {
    if (user) {
        setFirebaseTasks(currentTasks => currentTasks.filter(t => t.id !== taskId));
        try {
            await db.doc(`users/${user.id}/inbox/${taskId}`).delete();
        } catch (error) {
            showNotification({ message: 'Failed to delete task from Inbox.', type: 'error' });
        }
    } else {
        setLocalTasks(prev => prev.filter(t => t.id !== taskId));
    }
  }, [user, showNotification, setLocalTasks]);

  const importAndOverwriteInbox = useCallback(async (data: { inboxTasks: InboxTask[] }) => {
    if (!user) return;

    const CHUNK_SIZE = 400;
    const inboxRef = db.collection(`users/${user.id}/inbox`);
    const snapshot = await inboxRef.get();
    
    for (let i = 0; i < snapshot.docs.length; i += CHUNK_SIZE) {
        const batch = db.batch();
        snapshot.docs.slice(i, i + CHUNK_SIZE).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }

    const tasksWithTimestamps = data.inboxTasks.map(task => ({
        ...task,
        createdAt: firebase.firestore.Timestamp.fromMillis(task.createdAt),
    }));

    for (let i = 0; i < tasksWithTimestamps.length; i += CHUNK_SIZE) {
        const batch = db.batch();
        tasksWithTimestamps.slice(i, i + CHUNK_SIZE).forEach(task => {
            const { id, ...taskData } = task;
            batch.set(db.doc(`users/${user.id}/inbox/${id}`), taskData);
        });
        await batch.commit();
    }
  }, [user]);

  const contextValue = useMemo(() => ({
    tasks,
    loading,
    addTask,
    addMultipleTasks,
    deleteTask,
    importAndOverwriteInbox,
  }), [tasks, loading, addTask, addMultipleTasks, deleteTask, importAndOverwriteInbox]);

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
