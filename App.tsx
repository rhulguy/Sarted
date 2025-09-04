import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ProjectList from './components/ProjectList';
import TaskList from './components/TaskList';
import CreateProjectModal from './components/CreateProjectModal';
import { WelcomePlaceholder } from './components/WelcomePlaceholder';
import HabitTracker from './components/HabitTracker';
import CreateHabitModal from './components/CreateHabitModal';
import { Sidebar } from './components/Sidebar';
import { useProject } from './contexts/ProjectContext';
import ErrorBoundary from './components/ErrorBoundary';
import GlobalLoader from './components/GlobalLoader';
import { useIsMobile } from './hooks/useIsMobile';
import FocusView from './components/FocusView';
import InboxView from './components/InboxView';
import CommandBar from './components/CommandBar';
import WeeklyReviewModal from './components/WeeklyReviewModal';
import { useWeeklyReview } from './contexts/WeeklyReviewContext';
import GlobalCalendar from './components/GlobalCalendar';
import GlobalMindMapView from './components/GlobalMindMapView';
import { useAuth } from './contexts/AuthContext';
import GlobalGanttView from './components/GlobalGanttView';
import ProjectGroupEditorModal from './components/ProjectGroupEditorModal';


type MainView = 'focus' | 'projects' | 'habits' | 'inbox' | 'calendar' | 'global-mindmap' | 'global-gantt';

export default function App() {
  const { selectedProject, selectedProjectId, selectProject } = useProject();
  const { shouldShowReview, setReviewShown } = useWeeklyReview();
  const { loading: authLoading } = useAuth();
  
  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState<boolean>(false);
  const [isCommandBarOpen, setIsCommandBarOpen] = useState<boolean>(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [isGroupEditorOpen, setIsGroupEditorOpen] = useState<boolean>(false);

  const [mainView, setMainView] = useState<MainView>('focus');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  // Show the weekly review modal when the context says so.
  useEffect(() => {
    if (shouldShowReview) {
      setIsReviewModalOpen(true);
    }
  }, [shouldShowReview]);

  // Command Bar keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setIsCommandBarOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Effect to close mobile sidebar when switching to desktop
  useEffect(() => {
    if (!isMobile) {
      setIsSidebarOpen(false);
    }
  }, [isMobile]);

  // Effect to switch to project view when a project is selected
  // and close the mobile sidebar
  useEffect(() => {
    if (selectedProjectId) {
      setMainView('projects');
      if (isMobile) {
        setIsSidebarOpen(false);
      }
    }
  }, [selectedProjectId, isMobile]);
  
  const handleSetMainView = (view: MainView) => {
    setMainView(view);
    if (view !== 'projects') {
        selectProject(null);
    }
    if (isMobile) setIsSidebarOpen(false);
  }

  const renderMainContent = () => {
    switch (mainView) {
      case 'focus':
        return <FocusView onNewProject={() => setIsProjectModalOpen(true)} />;
      case 'inbox':
        return <InboxView />;
      case 'calendar':
        return <GlobalCalendar />;
      case 'global-mindmap':
        return <GlobalMindMapView onNewProject={() => setIsProjectModalOpen(true)} />;
      case 'global-gantt':
        return <GlobalGanttView />;
      case 'habits':
        return <HabitTracker onNewHabit={() => setIsHabitModalOpen(true)} />;
      case 'projects':
      default:
        if (selectedProject) {
          return <TaskList key={selectedProject.id} />;
        }
        return <WelcomePlaceholder onNewProject={() => setIsProjectModalOpen(true)} />;
    }
  };

  if (authLoading) {
    return <GlobalLoader />;
  }

  return (
    <div className="flex flex-col h-screen font-sans bg-primary">
      <GlobalLoader />
      <Header 
        onNewProject={() => setIsProjectModalOpen(true)}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isMobile={isMobile}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          mainView={mainView}
          onSetMainView={handleSetMainView}
          isMobile={isMobile}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        >
          <ProjectList 
            onNewProject={() => setIsProjectModalOpen(true)}
            onEditGroups={() => setIsGroupEditorOpen(true)}
          />
        </Sidebar>
        <main className="flex-1 p-2 md:p-6 overflow-y-auto">
          <ErrorBoundary>
            {renderMainContent()}
          </ErrorBoundary>
        </main>
      </div>
      {isProjectModalOpen && (
        <CreateProjectModal 
          isOpen={isProjectModalOpen}
          onClose={() => setIsProjectModalOpen(false)}
        />
      )}
      {isHabitModalOpen && (
        <CreateHabitModal
          isOpen={isHabitModalOpen}
          onClose={() => setIsHabitModalOpen(false)}
        />
      )}
      {isGroupEditorOpen && (
        <ProjectGroupEditorModal
          isOpen={isGroupEditorOpen}
          onClose={() => setIsGroupEditorOpen(false)}
        />
      )}
      {isCommandBarOpen && (
        <CommandBar 
            isOpen={isCommandBarOpen}
            onClose={() => setIsCommandBarOpen(false)}
        />
      )}
      {isReviewModalOpen && (
        <WeeklyReviewModal
            isOpen={isReviewModalOpen}
            onClose={() => {
                setIsReviewModalOpen(false);
                setReviewShown();
            }}
        />
      )}
    </div>
  );
}