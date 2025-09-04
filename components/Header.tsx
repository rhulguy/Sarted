import React from 'react';
import { PlusIcon, MenuIcon } from './IconComponents';
import Auth from './Auth';

interface HeaderProps {
  onNewProject: () => void;
  onToggleSidebar: () => void;
  isMobile: boolean;
}

const Header: React.FC<HeaderProps> = ({ onNewProject, onToggleSidebar, isMobile }) => {
  return (
    <header className="flex items-center justify-between p-4 bg-secondary border-b border-border-color shadow-md shrink-0">
      <div className="flex items-center space-x-3">
        {isMobile && (
          <button onClick={onToggleSidebar} className="text-text-primary p-1 -ml-2">
            <MenuIcon className="w-6 h-6" />
          </button>
        )}
        <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
        </div>
        <h1 className="text-xl font-bold text-text-primary">Synergize</h1>
      </div>
      <div className="flex items-center space-x-4">
        <button 
          onClick={onNewProject}
          className="flex items-center space-x-2 px-3 md:px-4 py-2 bg-accent text-white rounded-lg hover:bg-blue-500 transition-colors duration-200"
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