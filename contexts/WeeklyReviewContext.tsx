import React, { createContext, useState, useContext, ReactNode, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../services/firebase';
// FIX: Removed unused v9 modular imports. v8 API is used via the 'db' service.

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
      // FIX: Use v8 namespaced API for document access and snapshots.
      const settingsRef = db.doc(`users/${user.id}/settings/main`);
      const unsubscribe = settingsRef.onSnapshot((docSnap) => {
        if (docSnap.exists) {
          const data = docSnap.data();
          // FIX: In v8, a Timestamp is retrieved with .toDate()
          const lastShownTimestamp = data?.weeklyReviewLastShown?.toDate();
          if (lastShownTimestamp && (Date.now() - lastShownTimestamp.getTime() < ONE_WEEK_IN_MS)) {
            setShouldShowReview(false);
          } else {
            setShouldShowReview(true);
          }
        } else {
          // If settings doc doesn't exist, it's a new user or first time feature is used. Show it.
          setShouldShowReview(true);
        }
      });
      return () => unsubscribe();
    } else {
      // Logic for logged-out user, maybe use localStorage or just don't show.
      setShouldShowReview(false);
    }
  }, [user]);

  const setReviewShown = useCallback(async () => {
    if (user) {
      // FIX: Use v8 namespaced API to set document data.
      const settingsRef = db.doc(`users/${user.id}/settings/main`);
      await settingsRef.set({ weeklyReviewLastShown: new Date() }, { merge: true });
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
