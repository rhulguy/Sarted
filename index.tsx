import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { HabitProvider } from './contexts/HabitContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { InboxProvider } from './contexts/InboxContext';
import { WeeklyReviewProvider } from './contexts/WeeklyReviewContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <ProjectProvider>
        <HabitProvider>
          <InboxProvider>
            <WeeklyReviewProvider>
              <LoadingProvider>
                <App />
              </LoadingProvider>
            </WeeklyReviewProvider>
          </InboxProvider>
        </HabitProvider>
      </ProjectProvider>
    </AuthProvider>
  </React.StrictMode>
);