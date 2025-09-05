import React, { useState, useEffect, useMemo, useRef } from 'react';
import Header from './components/Header';
import ProjectList from './components/ProjectList';
import TaskList from './components/TaskList';
import CreateProjectModal from './components/CreateProjectModal';
import { WelcomePlaceholder } from './components/WelcomePlaceholder';
import HabitTracker from './components/HabitTracker';
import CreateHabitModal from './components/CreateHabitModal';
import { Sidebar } from './components/Sidebar';
import { useProject, useResource } from './contexts/ProjectContext';
import ErrorBoundary from './components/ErrorBoundary';
import GlobalLoader from './components/GlobalLoader';
import { useIsMobile } from './hooks/useIsMobile';
import InboxView from './components/InboxView';
import CommandBar from './components/CommandBar';
import WeeklyReviewModal from './components/WeeklyReviewModal';
import { useWeeklyReview } from './contexts/WeeklyReviewContext';
import GlobalCalendar from './components/GlobalCalendar';
import GlobalMindMapView from './components/GlobalMindMapView';
import { useAuth } from './contexts/AuthContext';
import GlobalGanttView from './components/GlobalGanttView';
import ProjectGroupEditorModal from './components/ProjectGroupEditorModal';
import { Resource, Project, ProjectGroup } from './types';
import { PlusIcon, TrashIcon, LinkIcon, ChevronDownIcon, ArchiveBoxIcon, PencilIcon } from './components/IconComponents';
import Spinner from './components/Spinner';
import { calculateProgress } from './utils/taskUtils';


// --- NEW RESOURCE COMPONENTS (Inlined due to file system constraints) ---

// Helper: Custom hook for detecting clicks outside an element
const useClickOutside = (ref: React.RefObject<HTMLElement>, handler: (event: MouseEvent) => void) => {
    useEffect(() => {
        const listener = (event: MouseEvent) => {
            if (!ref.current || ref.current.contains(event.target as Node)) {
                return;
            }
            handler(event);
        };
        document.addEventListener('mousedown', listener);
        return () => {
            document.removeEventListener('mousedown', listener);
        };
    }, [ref, handler]);
};

// Helper: Project Multi-Select Popover
const ProjectMultiSelect: React.FC<{
    selectedProjectIds: string[];
    onSelectionChange: (ids: string[]) => void;
    projects: Project[];
    projectGroups: ProjectGroup[];
    children: React.ReactNode;
}> = ({ selectedProjectIds, onSelectionChange, projects, projectGroups, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    useClickOutside(wrapperRef, () => setIsOpen(false));

    const handleToggleProject = (projectId: string) => {
        const newSelection = selectedProjectIds.includes(projectId)
            ? selectedProjectIds.filter(id => id !== projectId)
            : [...selectedProjectIds, projectId];
        onSelectionChange(newSelection);
    };

    const groupedProjects = useMemo(() => {
        return projectGroups
            .map(group => ({
                ...group,
                projects: projects.filter(p => p.groupId === group.id),
            }))
            .filter(group => group.projects.length > 0)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [projectGroups, projects]);

    return (
        <div className="relative" ref={wrapperRef}>
            <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full">
                {children}
            </button>
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-card-background border border-border-color rounded-xl shadow-soft z-20 max-h-60 overflow-y-auto p-2">
                    {groupedProjects.length > 0 ? (
                        groupedProjects.map(group => (
                            <div key={group.id} className="p-1">
                                <h4 className="text-xs font-semibold text-text-secondary uppercase px-2 mb-1 flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${group.color} shrink-0`}></div>
                                    {group.name}
                                </h4>
                                {group.projects.map(project => (
                                     <label key={project.id} className="flex items-center space-x-3 p-2 hover:bg-app-background cursor-pointer rounded-lg">
                                        <input
                                            type="checkbox"
                                            checked={selectedProjectIds.includes(project.id)}
                                            onChange={() => handleToggleProject(project.id)}
                                            className="w-4 h-4 rounded text-accent-blue focus:ring-accent-blue"
                                        />
                                        <span className="text-sm text-text-primary">{project.name}</span>
                                    </label>
                                ))}
                            </div>
                        ))
                    ) : (
                        <div className="p-2 text-sm text-text-secondary">No projects available.</div>
                    )}
                </div>
            )}
        </div>
    );
};


// AddResourceModal Component
const AddResourceModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { addResource } = useResource();
    const { projects, projectGroups } = useProject();
    const [url, setUrl] = useState('');
    const [metadata, setMetadata] = useState<{ title: string; thumbnailUrl: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [projectGroupId, setProjectGroupId] = useState(projectGroups[0]?.id || '');
    const [projectIds, setProjectIds] = useState<string[]>([]);
    const debounceTimeout = useRef<number | null>(null);

    useEffect(() => {
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        const urlInput = url.trim();
        if (!urlInput) {
            setMetadata(null); setError(''); setIsLoading(false); return;
        }
        setIsLoading(true); setError(''); setMetadata(null);
        debounceTimeout.current = window.setTimeout(() => {
            try {
                let fullUrl = urlInput;
                if (!/^https?:\/\//i.test(fullUrl)) fullUrl = 'https://' + fullUrl;
                const urlObject = new URL(fullUrl);
                const hostname = urlObject.hostname;
                setMetadata({ title: hostname.replace(/^www\./, ''), thumbnailUrl: `https://www.google.com/s2/favicons?sz=128&domain=${hostname}` });
            } catch (err) { setError("Please enter a valid URL."); setMetadata(null); } 
            finally { setIsLoading(false); }
        }, 500);
    }, [url]);

    const handleAddResource = () => {
        if (!metadata || !url || !projectGroupId) return;
        addResource({
            url, title: metadata.title, thumbnailUrl: metadata.thumbnailUrl, notes: '',
            projectGroupId, projectIds, isPinned: false, createdAt: Date.now(),
        });
        handleClose();
    };

    const handleClose = () => {
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        setUrl(''); setMetadata(null); setError(''); setIsLoading(false); setProjectIds([]);
        if(projectGroups.length > 0) setProjectGroupId(projectGroups[0].id);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-card-background rounded-2xl shadow-soft p-6 md:p-8 w-full max-w-xl flex flex-col">
                <div className="flex justify-between items-start mb-4"><h2 className="text-2xl font-bold">Add New Resource</h2><button onClick={handleClose} className="text-3xl text-text-secondary hover:text-text-primary">&times;</button></div>
                <div className="flex-grow space-y-4">
                    <div><label htmlFor="resourceUrl" className="block text-sm font-medium text-text-secondary">URL</label><div className="relative mt-1"><input id="resourceUrl" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" className="block w-full bg-app-background border-border-color rounded-lg p-2 pr-10" />{isLoading && (<div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"><Spinner /></div>)}</div></div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    {metadata && (
                        <div className="space-y-3 animate-fade-in">
                            <div className="flex items-center gap-4">
                                <img src={metadata.thumbnailUrl} alt="Favicon" className="w-12 h-12 rounded-full border-2 border-border-color p-1 object-contain" onError={(e) => { const t = e.target as HTMLImageElement; t.onerror = null; t.src = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZT0iIzY4NzI4MCI+PHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJNMTMuMTkgOC42ODhhNC41IDQuNSAwIDAxMS4yNDIgNy4yNDRsLTQuNSA0LjVhNC41IDQuNSAwIDAxLTYuMzY0LTYuMzY0bDEuNzU3LTEuNzU3bTEzLjM1LS42MjJsMS43NTctMS43NTdhNC41IDQuNSAwIDAwLTYuMzY0LTYuMzY0bC00LjUgNC41YTQuNSA0LjUgMCAwMDEuMjQyIDcuMjQ0IiAvPjwvc3ZnPg==`; t.classList.add('p-2', 'bg-app-background'); }} />
                                <div className="flex-grow"><h3 className="text-lg font-semibold">{metadata.title}</h3><p className="text-sm text-text-secondary truncate">{url}</p></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-border-color">
                                <div><label className="text-xs font-medium text-text-secondary">Project Group</label><select value={projectGroupId} onChange={e => setProjectGroupId(e.target.value)} className="w-full mt-1 bg-app-background border border-border-color rounded-lg p-2 text-sm"><option value="" disabled>Select a group</option>{projectGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
                                <div><label className="text-xs font-medium text-text-secondary">Link to Projects</label>
                                    <ProjectMultiSelect selectedProjectIds={projectIds} onSelectionChange={setProjectIds} projects={projects} projectGroups={projectGroups}>
                                        <div className="w-full mt-1 bg-app-background border border-border-color rounded-lg p-2 text-sm text-left flex justify-between items-center">
                                            <span>{projectIds.length > 0 ? `${projectIds.length} project(s) selected` : 'None selected'}</span>
                                            <ChevronDownIcon className="w-4 h-4" />
                                        </div>
                                    </ProjectMultiSelect>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="mt-6 flex justify-end gap-2"><button onClick={handleClose} className="px-4 py-2 bg-app-background rounded-lg hover:bg-border-color">Cancel</button><button onClick={handleAddResource} disabled={!metadata || isLoading || !projectGroupId} className="px-4 py-2 bg-accent-blue text-white rounded-lg disabled:opacity-50">Add Resource</button></div>
            </div>
        </div>
    );
};

// ResourceView Component
const ResourceView: React.FC<{ onAddResource: () => void }> = ({ onAddResource }) => {
    const { resources, loading, updateResource, deleteResource } = useResource();
    const { projects, projectGroups } = useProject();
    const [filterGroupId, setFilterGroupId] = useState('all');
    const [filterProjectId, setFilterProjectId] = useState('all');

    const filteredResources = useMemo(() => {
        return resources.filter(res => {
            const groupMatch = filterGroupId === 'all' || res.projectGroupId === filterGroupId;
            const projectMatch = filterProjectId === 'all' || res.projectIds.includes(filterProjectId);
            return groupMatch && projectMatch;
        });
    }, [resources, filterGroupId, filterProjectId]);

    return (
        <div className="h-full flex flex-col p-4 md:p-6">
            <header className="flex-wrap items-center justify-between pb-6 gap-4 flex">
                <div><h1 className="text-3xl font-bold">Resources</h1></div>
                <div className="flex items-center gap-2 flex-wrap">
                     <select value={filterGroupId} onChange={e => setFilterGroupId(e.target.value)} className="bg-card-background border border-border-color rounded-full px-4 py-2 text-sm"><option value="all">All Groups</option>{projectGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
                     <select value={filterProjectId} onChange={e => setFilterProjectId(e.target.value)} className="bg-card-background border border-border-color rounded-full px-4 py-2 text-sm"><option value="all">All Projects</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                </div>
            </header>
            <div className="flex-grow overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                     {loading ? (
                        Array.from({length: 4}).map((_, i) => <div key={i} className="h-64 bg-card-background rounded-2xl shadow-card animate-pulse"></div>)
                    ) : filteredResources.length === 0 ? (
                        <div className="col-span-full bg-card-background rounded-2xl shadow-card p-8 flex flex-col items-center justify-center text-center">
                            <div className="text-4xl mb-4">✨</div>
                            <h3 className="text-xl font-semibold mb-2">Add your first resource</h3>
                            <p className="text-text-secondary mb-4">Save links, articles, and inspiration.</p>
                            <button onClick={onAddResource} className="px-6 py-2 bg-accent-yellow text-text-primary font-semibold rounded-full hover:opacity-90">Add</button>
                        </div>
                    ) : (
                        filteredResources.map(res => (
                            <ResourceCard key={res.id} resource={res} onUpdate={updateResource} onDelete={deleteResource} projects={projects} projectGroups={projectGroups} />
                        ))
                    )}
                    <button onClick={onAddResource} className="border-2 border-dashed border-border-color rounded-2xl flex flex-col items-center justify-center text-text-secondary hover:bg-card-background hover:border-accent-blue transition-colors">
                        <PlusIcon className="w-8 h-8 mb-2" />
                        <span className="font-semibold">Add Resource</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

const ResourceCard: React.FC<{ resource: Resource, onUpdate: (r: Resource) => void, onDelete: (id: string) => void, projects: Project[], projectGroups: ProjectGroup[] }> = ({ resource, onUpdate, onDelete, projects, projectGroups }) => {
    const group = projectGroups.find(g => g.id === resource.projectGroupId);
    const linkedProjects = useMemo(() => resource.projectIds.map(id => projects.find(p => p.id === id)).filter(Boolean), [resource.projectIds, projects]);
    
    return (
        <div className="bg-card-background rounded-2xl shadow-card p-5 flex flex-col gap-4">
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <img src={resource.thumbnailUrl} alt={resource.title} className="w-12 h-12 rounded-full border-2 border-border-color p-1 object-contain" onError={(e) => { const t = e.target as HTMLImageElement; t.onerror = null; t.src = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZT0iIzY4NzI4MCI+PHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJNMTMuMTkgOC42ODhhNC41IDQuNSAwIDAxMS4yNDIgNy4yNDRsLTQuNSA0LjVhNC41IDQuNSAwIDAxLTYuMzY0LTYuMzY0bDEuNzU3LTEuNzU3bTEzLjM1LS42MjJsMS43NTctMS43NTdhNC41IDQuNSAwIDAwLTYuMzY0LTYuMzY0bC00LjUgNC41YTQuNSA0LjUgMCAwMDEuMjQyIDcuMjQ0IiAvPjwvc3ZnPg==`; t.classList.add('p-2', 'bg-app-background'); }} />
                    <div className="min-w-0">
                        <h3 className="font-semibold truncate">{resource.title}</h3>
                        <p className="text-sm text-text-secondary truncate">{resource.notes || "No notes yet."}</p>
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                    <a href={resource.url} target="_blank" rel="noopener noreferrer" title={resource.url} className="p-2 rounded-full hover:bg-app-background text-text-secondary"><LinkIcon className="w-5 h-5"/></a>
                    <button onClick={() => { if(window.confirm('Delete this resource?')) onDelete(resource.id); }} title="Delete" className="p-2 rounded-full hover:bg-app-background text-text-secondary"><TrashIcon className="w-5 h-5"/></button>
                </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                {group && <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${group.color}`}>{group.name}</span>}
                {linkedProjects.map(p => p && <span key={p.id} className="px-3 py-1 rounded-full text-xs font-medium bg-app-background text-text-secondary">{p.name}</span>)}
            </div>
        </div>
    );
};


// --- Projects Dashboard (Replaces WelcomePlaceholder) ---

const ProjectsDashboardView = () => {
    const { visibleProjects, projectGroups, selectProject, archiveProject, deleteProject, updateProject } = useProject();
    const isMobile = useIsMobile();

    const groupedProjects = useMemo(() => {
        return projectGroups
            .map(group => ({
                ...group,
                projects: visibleProjects.filter(p => p.groupId === group.id).sort((a,b) => a.name.localeCompare(b.name)),
            }))
            .filter(group => group.projects.length > 0)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [projectGroups, visibleProjects]);

    if (visibleProjects.length === 0) {
        // This should get a "Create Your First Project" modal trigger
        return <WelcomePlaceholder onNewProject={() => {}} />;
    }

    return (
        <div className="h-full flex flex-col p-4 md:p-6">
             <header className="mb-6">
                <h1 className="text-3xl font-bold">Projects Dashboard</h1>
                <p className="text-text-secondary">An overview of your active projects.</p>
            </header>
            <div className="flex-grow overflow-y-auto space-y-8">
                {groupedProjects.map(group => (
                    <div key={group.id}>
                         <h2 className="flex items-center text-xl font-semibold text-text-primary mb-3">
                            <span className={`w-4 h-4 rounded-full ${group.color} mr-3`}></span>
                            {group.name}
                        </h2>
                        <div className={`grid gap-4 md:gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                            {group.projects.map(project => 
                                <ProjectCard 
                                    key={project.id} 
                                    project={project} 
                                    onClick={() => selectProject(project.id)}
                                    onArchive={() => archiveProject(project.id)}
                                    onDelete={() => deleteProject(project.id)}
                                    onUpdate={updateProject}
                                />
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ProjectCard: React.FC<{ project: Project, onClick: () => void, onArchive: () => void, onDelete: () => void, onUpdate: (id: string, updates: Partial<Project>) => void }> = ({ project, onClick, onArchive, onDelete, onUpdate }) => {
    const { completed, total } = useMemo(() => calculateProgress(project.tasks), [project.tasks]);
    const progress = total > 0 ? (completed / total) * 100 : 0;
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [newName, setNewName] = useState(project.name);
    const menuRef = useRef<HTMLDivElement>(null);
    useClickOutside(menuRef, () => setIsMenuOpen(false));

    const handleRename = () => {
        if (newName.trim() && newName !== project.name) {
            onUpdate(project.id, { name: newName.trim() });
        }
        setIsRenaming(false);
        setIsMenuOpen(false);
    };
    
    return (
        <div className="bg-card-background rounded-xl border border-border-color flex flex-col group transition-shadow hover:shadow-soft">
            <div className="p-4 flex-grow cursor-pointer" onClick={onClick}>
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{project.icon || '📁'}</span>
                        {isRenaming ? (
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onBlur={handleRename}
                                onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setIsRenaming(false); }}
                                className="text-lg font-semibold bg-app-background border border-accent-blue rounded px-2 -ml-2"
                                autoFocus
                                onClick={e => e.stopPropagation()}
                            />
                        ) : (
                             <h3 className="text-lg font-semibold text-text-primary group-hover:text-accent-blue">{project.name}</h3>
                        )}
                    </div>
                    <div className="relative" ref={menuRef}>
                        <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(o => !o); }} className="p-1 text-text-secondary hover:text-text-primary">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                        </button>
                        {isMenuOpen && (
                            <div className="absolute top-full right-0 mt-1 w-40 bg-card-background border border-border-color rounded-lg shadow-soft z-10">
                                <button onClick={(e) => { e.stopPropagation(); setIsRenaming(true); }} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-app-background"><PencilIcon className="w-4 h-4"/>Rename</button>
                                <button onClick={(e) => { e.stopPropagation(); onArchive(); }} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-app-background"><ArchiveBoxIcon className="w-4 h-4"/>Archive</button>
                                <button onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete this project forever?')) onDelete(); }} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-accent-red hover:bg-app-background"><TrashIcon className="w-4 h-4"/>Delete</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {total > 0 && (
                <div className="px-4 pb-4">
                     <div className="w-full bg-app-background rounded-full h-1.5"><div className="bg-accent-blue h-1.5 rounded-full" style={{ width: `${progress}%` }}></div></div>
                </div>
            )}
        </div>
    );
};


// --- App Component ---
type MainView = 'projects' | 'habits' | 'inbox' | 'calendar' | 'global-mindmap' | 'global-gantt' | 'resources';

export default function App() {
  const { selectedProject, selectedProjectId, selectProject } = useProject();
  const { shouldShowReview, setReviewShown } = useWeeklyReview();
  const { loading: authLoading } = useAuth();
  
  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState<boolean>(false);
  const [isCommandBarOpen, setIsCommandBarOpen] = useState<boolean>(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [isGroupEditorOpen, setIsGroupEditorOpen] = useState<boolean>(false);
  const [isAddResourceModalOpen, setIsAddResourceModalOpen] = useState<boolean>(false);

  const [mainView, setMainView] = useState<MainView>('projects');
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
      case 'resources':
        return <ResourceView onAddResource={() => setIsAddResourceModalOpen(true)} />;
      case 'projects':
      default:
        if (selectedProject) {
          return <TaskList key={selectedProject.id} />;
        }
        return <ProjectsDashboardView />;
    }
  };

  if (authLoading) {
    return <GlobalLoader />;
  }

  return (
    <div className="flex flex-col h-screen font-sans bg-app-background">
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
        <main className="flex-1 bg-card-background md:p-0">
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
       {isAddResourceModalOpen && (
        <AddResourceModal
          isOpen={isAddResourceModalOpen}
          onClose={() => setIsAddResourceModalOpen(false)}
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