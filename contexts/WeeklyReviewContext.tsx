import React, { createContext, useState, useContext, ReactNode, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../services/firebase';
import { doc, onSnapshot, setDoc, Timestamp } from 'firebase/firestore';

interface WeeklyReviewContextType {
  shouldShowReview: boolean;
  setReviewShown: () => void;
}

const WeeklyReviewContext = createContext<WeeklyReviewContextType | undefined>(undefined);

const ONE_WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

export const WeeklyReviewProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [shouldShowReview, setShouldShowReview] = useState(false);

  useEffect(() => {
    if (user) {
      const settingsRef = doc(db, `users/${user.id}/settings/main`);
      const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const lastShownTimestamp = data?.weeklyReviewLastShown as Timestamp | undefined;
          if (lastShownTimestamp && (Date.now() - lastShownTimestamp.toMillis() < ONE_WEEK_IN_MS)) {
            setShouldShowReview(false);
          } else {
            setShouldShowReview(true);
          }
        } else {
          setShouldShowReview(true);
        }
      });
      return () => unsubscribe();
    } else {
      setShouldShowReview(false);
    }
  }, [user]);

  const setReviewShown = useCallback(async () => {
    if (user) {
      const settingsRef = doc(db, `users/${user.id}/settings/main`);
      await setDoc(settingsRef, { weeklyReviewLastShown: new Date() }, { merge: true });
      setShouldShowReview(false);
    }
  }, [user]);

  const contextValue = useMemo(() => ({
    shouldShowReview,
    setReviewShown
  }), [shouldShowReview, setReviewShown]);

  return (
    <WeeklyReviewContext.Provider value={contextValue}>
      {children}
    </WeeklyReviewContext.Provider>
  );
};

export const useWeeklyReview = (): WeeklyReviewContextType => {
  const context = useContext(WeeklyReviewContext);
  if (context === undefined) {
    throw new Error('useWeeklyReview must be used within a WeeklyReviewProvider');
  }
  return context;
};