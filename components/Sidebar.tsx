import React from 'react';
import { FolderIcon, TrendingUpIcon, InboxIcon, CalendarIcon, MindMapIcon, GanttIcon, BookmarkSquareIcon, UserCircleIcon, ImageIcon, CogIcon } from './IconComponents';

type MainView = 'projects' | 'habits' | 'inbox' | 'calendar' | 'global-mindmap' | 'global-gantt' | 'resources' | 'dreamboard' | 'settings';

interface SidebarProps {
  mainView: MainView;
  onSetMainView: (view: MainView) => void;
  isMobile: boolean;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({ mainView, onSetMainView, isMobile, isOpen, onClose, children }) => {
  const navItems = [
    { id: 'inbox', name: 'Inbox', icon: InboxIcon },
    { id: 'calendar', name: 'Global Calendar', icon: CalendarIcon },
    { id: 'dreamboard', name: 'Dream Board', icon: ImageIcon },
    { id: 'global-mindmap', name: 'Global Map', icon: MindMapIcon },
    { id: 'global-gantt', name: 'Global Gantt', icon: GanttIcon },
    { id: 'resources', name: 'Resources', icon: BookmarkSquareIcon },
    { id: 'projects', name: 'Projects', icon: FolderIcon },
    { id: 'habits', name: 'Habits', icon: TrendingUpIcon },
    { id: 'settings', name: 'Settings', icon: CogIcon },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {isMobile && (
        <button onClick={onClose} className="absolute top-2 right-4 text-text-secondary text-3xl z-50">&times;</button>
      )}
      <div className="mb-6 mt-8 md:mt-0">
        <nav className="flex flex-col space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => onSetMainView(item.id as MainView)}
              className={`flex items-center space-x-3 py-2 px-3 text-sm font-semibold rounded-md transition-colors duration-200 w-full text-left ${
                (mainView === item.id || (mainView === 'projects' && item.id === 'projects'))
                  ? 'bg-app-background text-text-primary' 
                  : 'text-text-secondary hover:bg-app-background hover:text-text-primary'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.name}</span>
            </button>
          ))}
        </nav>
      </div>
      <div className="flex-1 overflow-y-auto border-t border-border-color pt-4">
        {children}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div 
          className={`fixed inset-0 bg-black bg-opacity-50 z-30 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
          onClick={onClose} 
          aria-hidden="true"
        />
        <aside 
          className={`fixed top-0 left-0 h-full w-72 bg-sidebar-background p-4 z-40 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
          aria-label="Main Navigation"
        >
          {sidebarContent}
        </aside>
      </>
    );
  }

  return (
    <aside className="w-72 bg-sidebar-background p-4 border-r border-border-color flex-col shrink-0 hidden md:flex">
      {sidebarContent}
    </aside>
  );
};