import React, { createContext, useReducer, useContext, ReactNode, useMemo } from 'react';

// --- STATE AND ACTION TYPES ---

interface LoadingState {
  isLoading: boolean;
}

type LoadingAction = { type: 'SET_LOADING'; payload: boolean };

interface LoadingContextType extends LoadingState {
  dispatch: React.Dispatch<LoadingAction>;
}

// --- REDUCER ---

const loadingReducer = (state: LoadingState, action: LoadingAction): LoadingState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { isLoading: action.payload };
    default:
      return state;
  }
};

// --- CONTEXT PROVIDER ---

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

const initialState: LoadingState = {
  isLoading: false,
};

export const LoadingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(loadingReducer, initialState);

  const contextValue = useMemo(() => ({
    ...state,
    dispatch
  }), [state]);

  return (
    <LoadingContext.Provider value={contextValue}>
      {children}
    </LoadingContext.Provider>
  );
};

// --- CUSTOM HOOK ---

export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};