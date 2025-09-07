import React, { useMemo } from 'react';
import { PlusIcon, MenuIcon, GitHubIcon, SartedLogoIcon, ListIcon, GanttIcon, MindMapIcon, CalendarIcon, BookmarkSquareIcon } from './IconComponents';
import Auth from './Auth';
import { Project, ProjectView } from '../types';

interface HeaderProps {
  onNewProject: () => void;
  onToggleSidebar: () => void;
  isMobile: boolean;
  selectedProject: Project | null;
  projectView: ProjectView;
  setProjectView: (view: ProjectView) => void;
}

const Header: React.FC<HeaderProps> = ({ onNewProject, onToggleSidebar, isMobile, selectedProject, projectView, setProjectView }) => {
  const GITHUB_REPO_URL = "https://github.com/rhulguy/Sarted";

  const allViewButtons = useMemo(() => [
    { id: 'list', name: 'List', icon: ListIcon },
    { id: 'gantt', name: 'Gantt', icon: GanttIcon },
    { id: 'mindmap', name: 'Mind Map', icon: MindMapIcon },
    { id: 'calendar', name: 'Calendar', icon: CalendarIcon },
    { id: 'resources', name: 'Resources', icon: BookmarkSquareIcon },
  ], []);

  const viewButtons = useMemo(() => {
    const mobileViews: ProjectView[] = ['list', 'calendar', 'resources'];
    if (isMobile) {
        return allViewButtons.filter(b => mobileViews.includes(b.id as ProjectView));
    }
    return allViewButtons;
  }, [isMobile, allViewButtons]);

  return (
    <header className="flex items-center justify-between p-4 bg-card-background border-b border-border-color shrink-0">
      <div className="flex items-center space-x-3">
        {isMobile && (
          <button onClick={onToggleSidebar} className="text-text-primary p-1 -ml-2">
            <MenuIcon className="w-6 h-6" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <SartedLogoIcon className="w-7 h-7" />
          <h1 className="text-xl font-bold text-text-primary">sarted</h1>
          <span className="text-xs text-text-secondary mt-1">v1.1</span>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        {selectedProject && (
            <div className="bg-app-background border border-border-color p-1 rounded-full flex space-x-1">
                {viewButtons.map(button => (
                    <button
                        key={button.id}
                        onClick={() => setProjectView(button.id as ProjectView)}
                        className={`flex items-center space-x-2 py-1.5 px-3 text-sm font-medium rounded-full transition-colors shrink-0 ${
                            projectView === button.id
                            ? 'bg-accent-blue text-white'
                            : 'text-text-secondary hover:text-text-primary hover:bg-card-background'
                        }`}
                    >
                        <button.icon className="w-5 h-5" />
                        <span className="hidden md:inline">{button.name}</span>
                    </button>
                ))}
            </div>
        )}
        <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer" title="View on GitHub" className="text-text-secondary hover:text-text-primary">
          <GitHubIcon className="w-6 h-6" />
        </a>
        <button 
          onClick={onNewProject}
          className="flex items-center space-x-2 px-3 md:px-4 py-2 bg-accent-blue text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          <PlusIcon className="w-5 h-5" />
          <span className="hidden md:inline">New Project</span>
        </button>
        <Auth />
      </div>
    </header>
  );
};

export default Header;