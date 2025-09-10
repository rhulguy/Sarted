import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ProjectProvider, ResourceProvider } from './contexts/ProjectContext';
import { HabitProvider } from './contexts/HabitContext';
import { InboxProvider } from './contexts/InboxContext';
import { WeeklyReviewProvider } from './contexts/WeeklyReviewContext';
import { NotificationProvider } from './contexts/NotificationContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <NotificationProvider>
      <AuthProvider>
        <ProjectProvider>
          <ResourceProvider>
            <HabitProvider>
              <InboxProvider>
                <WeeklyReviewProvider>
                  <App />
                </WeeklyReviewProvider>
              </InboxProvider>
            </HabitProvider>
          </ResourceProvider>
        </ProjectProvider>
      </AuthProvider>
    </NotificationProvider>
  </React.StrictMode>
);