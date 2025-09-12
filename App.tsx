import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import Header from './components/Header';
import CreateProjectModal from './components/CreateProjectModal';
import CreateHabitModal from './components/CreateHabitModal';
import { Sidebar } from './components/Sidebar';
import { useProject, useResource } from './contexts/ProjectContext';
import ErrorBoundary from './components/ErrorBoundary';
import { useIsMobile } from './hooks/useIsMobile';
import CommandBar from './components/CommandBar';
import WeeklyReviewModal from './components/WeeklyReviewModal';
import { useWeeklyReview } from './contexts/WeeklyReviewContext';
import { useAuth } from './contexts/AuthContext';
import ProjectGroupEditorModal from './components/ProjectGroupEditorModal';
import { ProjectView } from './types';
import { SartedLogoIcon } from './components/IconComponents';
import FAB from './components/FAB';
import ToastContainer from './components/Toast';
import AddResourceModal from './components/AddResourceModal';
import QuickAddTaskModal from './components/QuickAddTaskModal';
import { useHabit } from './contexts/HabitContext';
import { useInbox } from './contexts/InboxContext';

// --- Lazy-loaded View Components ---
const TaskList = lazy(() => import('./components/TaskList'));
const WelcomePlaceholder = lazy(() => import('./components/WelcomePlaceholder').then(module => ({ default: module.WelcomePlaceholder })));
const HabitTracker = lazy(() => import('./components/HabitTracker'));
const GlobalCalendar = lazy(() => import('./components/GlobalCalendar'));
const GlobalMindMapView = lazy(() => import('./components/GlobalMindMapView'));
const GlobalGanttView = lazy(() => import('./components/GlobalGanttView'));
const SettingsView = lazy(() => import('./components/SettingsView'));
const HomePage = lazy(() => import('./components/HomePage'));
const GlobalListView = lazy(() => import('./components/GlobalListView'));
const FocusView = lazy(() => import('./components/FocusView'));
const ResourceView = lazy(() => import('./components/ResourceView'));
const DreamBoardView = lazy(() => import('./components/DreamBoardView'));


// --- App Component ---
export type MainView = 'projects' | 'habits' | 'list-inbox' | 'calendar' | 'global-mindmap' | 'global-gantt' | 'resources' | 'dreamboard' | 'settings' | 'focus';

export default function App() {
  const { projects, selectedProject, selectProject, loading: projectLoading } = useProject();
  const { shouldShowReview, setReviewShown } = useWeeklyReview();
  const { user, loading: authLoading } = useAuth();
  const { loading: habitLoading } = useHabit();
  const { loading: inboxLoading } = useInbox();
  const { loading: resourceLoading } = useResource();
  const prevUser = useRef(user);
  
  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState<boolean>(false);
  const [isCommandBarOpen, setIsCommandBarOpen] = useState<boolean>(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [isGroupEditorOpen, setIsGroupEditorOpen] = useState<boolean>(false);
  const [isAddResourceModalOpen, setIsAddResourceModalOpen] = useState<boolean>(false);
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState<boolean>(false);
  const [resourceModalContext, setResourceModalContext] = useState<{ projectId?: string; groupId?: string } | null>(null);
  const [initialProjectView, setInitialProjectView] = useState<ProjectView>('list');

  const [mainView, setMainView] = useState<MainView>('projects');
  const [previousMainView, setPreviousMainView] = useState<MainView>('projects');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  
  // Aggregate all loading states for a single, reliable initial loading screen
  const isAppLoading = authLoading || (user && (projectLoading || habitLoading || inboxLoading || resourceLoading));

  useEffect(() => {
    if (authLoading) return;
    if (!prevUser.current && user) {
        setMainView('projects');
    } else if (!user) {
        setMainView('projects'); 
    }
    prevUser.current = user;
  }, [user, authLoading]);

  useEffect(() => {
    if (shouldShowReview) {
      setIsReviewModalOpen(true);
    }
  }, [shouldShowReview]);

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

  useEffect(() => {
    if (!isMobile) {
      setIsSidebarOpen(false);
    }
  }, [isMobile]);
  
  const handleSetMainView = (view: MainView) => {
    setMainView(view);
    if (selectedProject) {
        selectProject(null);
    }
    setInitialProjectView('list');
    if (isMobile) setIsSidebarOpen(false);
  }
  
  const handleNavigateToProject = (projectId: string, view: ProjectView) => {
    setPreviousMainView(mainView);
    setInitialProjectView(view);
    setMainView('projects'); 
    selectProject(projectId);
  };
  
  const handleGoBack = () => {
      selectProject(null);
      setMainView(previousMainView);
  }

  const handleOpenAddResourceModal = (context?: { projectId?: string; groupId?: string }) => {
    setResourceModalContext(context || null);
    setIsAddResourceModalOpen(true);
  };

  const renderMainContent = () => {
    if (selectedProject) {
      return <TaskList 
        key={selectedProject.id} 
        onAddResource={() => handleOpenAddResourceModal({ projectId: selectedProject.id, groupId: selectedProject.groupId })}
        initialView={initialProjectView}
        previousView={previousMainView}
        onGoBack={handleGoBack}
       />;
    }

    switch (mainView) {
      case 'list-inbox':
        return <GlobalListView />;
      case 'calendar':
        return <GlobalCalendar />;
      case 'dreamboard':
        return <DreamBoardView />;
      case 'global-mindmap':
        return <GlobalMindMapView onNewProject={() => setIsProjectModalOpen(true)} onNavigateToProject={handleNavigateToProject} />;
      case 'global-gantt':
        return <GlobalGanttView onNavigateToProject={handleNavigateToProject} />;
      case 'habits':
        return <HabitTracker onNewHabit={() => setIsHabitModalOpen(true)} />;
      case 'resources':
        return <ResourceView onAddResource={() => handleOpenAddResourceModal()} />;
      case 'settings':
        return <SettingsView />;
      case 'focus':
        return <FocusView onNavigate={handleSetMainView} />;
      case 'projects':
      default:
        if (projects.length === 0 && user) { 
            return <WelcomePlaceholder onNewProject={() => setIsProjectModalOpen(true)} />;
        }
        return <HomePage onNavigate={handleSetMainView} onManageGroups={() => setIsGroupEditorOpen(true)} />;
    }
  };

  if (isAppLoading) {
    return (
        <div className="fixed inset-0 bg-app-background flex items-center justify-center">
            <SartedLogoIcon className="w-16 h-16 animate-pulse-subtle" />
        </div>
    );
  }

  return (
    <div className="flex flex-col h-screen font-sans bg-app-background">
      <ToastContainer />
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
          onNewProject={() => setIsProjectModalOpen(true)}
          onManageGroups={() => setIsGroupEditorOpen(true)}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 bg-card-background md:p-0 overflow-y-auto min-h-0">
            <ErrorBoundary>
              <Suspense fallback={<div className="flex h-full w-full items-center justify-center"><SartedLogoIcon className="w-12 h-12 animate-pulse-subtle" /></div>}>
                {renderMainContent()}
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <FAB onClick={() => setIsQuickAddModalOpen(true)} />
      <QuickAddTaskModal
        isOpen={isQuickAddModalOpen}
        onClose={() => setIsQuickAddModalOpen(false)}
        projectId={selectedProject?.id}
      />
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
       <AddResourceModal
          isOpen={isAddResourceModalOpen}
          onClose={() => setIsAddResourceModalOpen(false)}
          initialContext={resourceModalContext || undefined}
        />
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