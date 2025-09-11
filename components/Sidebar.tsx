import React from 'react';
import { FolderIcon, TrendingUpIcon, InboxIcon, CogIcon, FocusIcon } from './IconComponents';
import { useProject } from '../contexts/ProjectContext';
import { MainView } from '../App';
import ProjectList from './ProjectList';

interface SidebarProps {
  mainView: MainView;
  onSetMainView: (view: MainView) => void;
  isMobile: boolean;
  isOpen: boolean;
  onClose: () => void;
  onNewProject: () => void;
  onManageGroups: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mainView, onSetMainView, isMobile, isOpen, onClose, onNewProject, onManageGroups }) => {
  const { selectedProject } = useProject();

  const navItems = [
    { id: 'projects', name: 'Dashboard', icon: FolderIcon },
    { id: 'list-inbox', name: 'Inbox', icon: InboxIcon },
    { id: 'focus', name: 'Focus', icon: FocusIcon },
    { id: 'habits', name: 'Habits', icon: TrendingUpIcon },
    { id: 'settings', name: 'Settings', icon: CogIcon },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {isMobile && (
        <button onClick={onClose} className="absolute top-2 right-4 text-text-secondary text-3xl z-50">&times;</button>
      )}
      <div className="mb-6 mt-8 md:mt-0 flex-grow overflow-y-auto flex flex-col">
        <nav className="flex flex-col space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => onSetMainView(item.id as MainView)}
              className={`flex items-center space-x-3 py-2 px-3 text-sm font-semibold rounded-md transition-colors duration-200 w-full text-left ${
                (mainView === item.id && !selectedProject)
                  ? 'bg-app-background text-text-primary' 
                  : 'text-text-secondary hover:bg-app-background hover:text-text-primary'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.name}</span>
            </button>
          ))}
        </nav>
        <div className="mt-6 border-t border-border-color pt-4 flex-grow flex flex-col">
          <ProjectList 
            onNewProject={onNewProject}
            onEditGroups={onManageGroups}
          />
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
        <>
            <div 
                className={`fixed inset-0 bg-black bg-opacity-50 z-30 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
                onClick={onClose} 
            />
            <aside className={`fixed top-0 left-0 h-full w-64 bg-card-background p-4 z-40 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {sidebarContent}
            </aside>
        </>
    );
  }

  return (
    <aside className="w-64 shrink-0 bg-card-background p-4 border-r border-border-color flex-col hidden md:flex">
        {sidebarContent}
    </aside>
  );
};