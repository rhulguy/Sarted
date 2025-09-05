import React from 'react';
import { PlusIcon, MenuIcon, GitHubIcon, SartedLogoIcon } from './IconComponents';
import Auth from './Auth';

interface HeaderProps {
  onNewProject: () => void;
  onToggleSidebar: () => void;
  isMobile: boolean;
}

const Header: React.FC<HeaderProps> = ({ onNewProject, onToggleSidebar, isMobile }) => {
  const GITHUB_REPO_URL = "https://github.com/rhulguy/Sarted";

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
        </div>
      </div>
      <div className="flex items-center space-x-4">
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