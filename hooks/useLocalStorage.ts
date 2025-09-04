import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function readValue<T>(key: string, initialValue: T, userSpecificInitialValue?: T): T {
    // This function is temporarily simplified as useAuth is a hook and cannot be called here.
    // In a real app, you might pass the user object in.
    try {
        const item = window.localStorage.getItem(key);
        if (item) {
            return JSON.parse(item);
        }
        return initialValue;
    } catch (error) {
        console.warn(`Error reading localStorage key “${key}”:`, error);
        return initialValue;
    }
}

function useLocalStorage<T>(key: string, initialValue: T, userSpecificInitialValue?: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const { user } = useAuth();
  const userKey = user ? `${user.id}_${key}` : key;

  const readValueCallback = useCallback((): T => {
    try {
      const item = window.localStorage.getItem(userKey);
      if (item) {
        return JSON.parse(item);
      }
      return user ? (userSpecificInitialValue !== undefined ? userSpecificInitialValue : initialValue) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key “${userKey}”:`, error);
      return initialValue;
    }
  }, [user, userKey, initialValue, userSpecificInitialValue]);

  const [storedValue, setStoredValue] = useState<T>(readValueCallback);

  useEffect(() => {
    setStoredValue(readValueCallback());
  }, [user, readValueCallback]);

  useEffect(() => {
    try {
      window.localStorage.setItem(userKey, JSON.stringify(storedValue));
    } catch (error) {
      console.warn(`Error setting localStorage key “${userKey}”:`, error);
    }
  }, [userKey, storedValue]);

  return [storedValue, setStoredValue];
}

export default useLocalStorage;
