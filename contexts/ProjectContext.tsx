import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { Project, ProjectGroup, Task, Resource } from '../types';
import { useAuth } from './AuthContext';
import { db } from '../services/firebase';
import { collection, doc, getDocs, query, limit, writeBatch, onSnapshot, orderBy, setDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { INITIAL_PROJECT_GROUPS, INITIAL_PROJECTS, INITIAL_RESOURCES, COLOR_PALETTE } from '../constants';
import { updateTaskInTree, deleteTaskFromTree, addSubtaskToTree, updateTasksInTree, findAndRemoveTask } from '../utils/taskUtils';
import useLocalStorage from '../hooks/useLocalStorage';

// --- PROJECT CONTEXT ---

interface ProjectContextType {
  projects: Project[];
  visibleProjects: Project[]; // Active (non-archived) projects
  archivedProjects: Project[]; // Archived projects
  projectGroups: ProjectGroup[];
  selectedProjectId: string | null;
  selectedProject: Project | null;
  loading: boolean;
  selectProject: (id: string | null) => void;
  addProject: (project: Omit<Project, 'id' | 'isArchived'>) => Promise<void>;
  updateProject: (projectId: string, updates: Partial<Omit<Project, 'id'>>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  archiveProject: (id: string) => Promise<void>;
  unarchiveProject: (id: string) => Promise<void>;
  addProjectGroup: (group: Omit<ProjectGroup, 'id' | 'order' | 'color'>) => Promise<void>;
  updateProjectGroup: (group: ProjectGroup) => Promise<void>;
  deleteProjectGroup: (groupId: string) => Promise<void>;
  reorderProjectGroups: (groups: ProjectGroup[]) => Promise<void>;
  addTask: (projectId: string, task: Task) => Promise<void>;
  addSubtask: (projectId: string, parentId: string, subtask: Task) => Promise<void>;
  updateTask: (projectId: string, task: Task) => Promise<void>;
  updateMultipleTasks: (projectId: string, tasks: Task[]) => Promise<void>;
  deleteTask: (projectId: string, taskId: string) => Promise<void>;
  moveTask: (sourceProjectId: string, targetProjectId: string, task: Task) => Promise<void>;
  reparentTask: (projectId: string, taskId: string, newParentId: string | null) => Promise<void>;
}

export const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  
  // State for anonymous users (persisted in localStorage)
  const [localProjects, setLocalProjects] = useLocalStorage<Project[]>('sarted-anonymous-projects', INITIAL_PROJECTS);
  const [localProjectGroups, setLocalProjectGroups] = useLocalStorage<ProjectGroup[]>('sarted-anonymous-groups', INITIAL_PROJECT_GROUPS);

  // State for logged-in users (synced with Firebase)
  const [firebaseProjects, setFirebaseProjects] = useState<Project[]>([]);
  const [firebaseProjectGroups, setFirebaseProjectGroups] = useState<ProjectGroup[]>([]);
  
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Select the correct data source based on auth state
  const projects = useMemo(() => (user ? firebaseProjects : localProjects), [user, firebaseProjects, localProjects]);
  const projectGroups = useMemo(() => (user ? firebaseProjectGroups : localProjectGroups), [user, firebaseProjectGroups, localProjectGroups]);

  // Firestore listener effect
  useEffect(() => {
    if (authLoading) {
        setLoading(true);
        setFirebaseProjects([]);
        setFirebaseProjectGroups([]);
        setSelectedProjectId(null);
        return; 
    }

    if (user) {
      setLoading(true);

      const projectsQuery = collection(db, `users/${user.id}/projects`);
      const groupsQuery = query(collection(db, `users/${user.id}/projectGroups`), orderBy('order'));

      const unsubProjects = onSnapshot(projectsQuery, (snapshot) => {
        const userProjects = snapshot.docs.map(d => {
            const data = d.data();
            if (!data) return { id: d.id, name: 'Invalid Project Data', groupId: '', tasks: [], isArchived: true } as Project;
            const traverseAndFixTasks = (tasks: any[]): Task[] => {
                if (!Array.isArray(tasks)) return [];
                return tasks.map(t => ({ ...t, id: t.id || `task-${Math.random()}`, name: t.name || 'Untitled Task', completed: t.completed ?? false, description: t.description || '', subtasks: traverseAndFixTasks(t.subtasks) }));
            }
            return { id: d.id, name: data.name || 'Untitled Project', groupId: data.groupId || '', tasks: traverseAndFixTasks(data.tasks), isArchived: data.isArchived ?? false, icon: data.icon } as Project;
        });
        setFirebaseProjects(userProjects);
      }, (error) => console.error("Error fetching projects:", error));
      
      const unsubGroups = onSnapshot(groupsQuery, (snapshot) => {
        const userGroups = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ProjectGroup));
        if (userGroups.length > 0 && userGroups.some(g => g.order === undefined)) {
            const batch = writeBatch(db);
            userGroups.forEach((group, index) => { if (group.order === undefined) batch.update(doc(db, `users/${user.id}/projectGroups/${group.id}`), { order: index }); });
            batch.commit().catch(err => console.error("Failed to migrate group order:", err));
        } else {
            setFirebaseProjectGroups(userGroups);
        }
        setLoading(false);
      }, (error) => { console.error("Error fetching groups:", error); setLoading(false); });
      
      return () => { unsubProjects(); unsubGroups(); };
    } else {
      setFirebaseProjects([]);
      setFirebaseProjectGroups([]);
      setSelectedProjectId(null);
      setLoading(false);
    }
  }, [user, authLoading]);

  const selectProject = useCallback((id: string | null) => {
    const project = projects.find(p => p.id === id);
    if (project && project.isArchived) return;
    setSelectedProjectId(id);
  }, [projects]);
  
  const addProject = useCallback(async (projectData: Omit<Project, 'id' | 'isArchived'>) => {
    const newProject: Project = { ...projectData, id: `project-${Date.now()}`, isArchived: false};
    const setter = user ? setFirebaseProjects : setLocalProjects;
    setter(prev => [...prev, newProject]);
    selectProject(newProject.id);
    if (user) {
        try { await setDoc(doc(db, `users/${user.id}/projects/${newProject.id}`), newProject); } 
        catch (error) { console.error("Failed to add project, reverting:", error); setter(prev => prev.filter(p => p.id !== newProject.id)); }
    }
  }, [user, setFirebaseProjects, setLocalProjects, selectProject]);
  
  const updateProject = useCallback(async (projectId: string, updates: Partial<Omit<Project, 'id'>>) => {
    const setter = user ? setFirebaseProjects : setLocalProjects;
    setter(prev => prev.map(p => p.id === projectId ? { ...p, ...updates } as Project : p));
    if (user) {
      try { await updateDoc(doc(db, `users/${user.id}/projects/${projectId}`), updates); } 
      catch (error) { console.error("Failed to update project:", error); /* Revert handled by next Firestore snapshot */ }
    }
  }, [user, setFirebaseProjects, setLocalProjects]);

  const deleteProject = useCallback(async (id: string) => {
    if (selectedProjectId === id) selectProject(null);
    const setter = user ? setFirebaseProjects : setLocalProjects;
    setter(prev => prev.filter(p => p.id !== id));
    if (user) {
      try { await deleteDoc(doc(db, `users/${user.id}/projects/${id}`)); } 
      catch (error) { console.error("Failed to delete project:", error); /* Revert handled by next Firestore snapshot */ }
    }
  }, [user, setFirebaseProjects, setLocalProjects, selectedProjectId, selectProject]);
  
  const archiveProject = useCallback(async (projectId: string) => {
      if (selectedProjectId === projectId) selectProject(null);
      await updateProject(projectId, { isArchived: true });
  }, [selectedProjectId, selectProject, updateProject]);

  const unarchiveProject = useCallback(async (projectId: string) => { await updateProject(projectId, { isArchived: false }); }, [updateProject]);

  const addProjectGroup = useCallback(async (groupData: Omit<ProjectGroup, 'id' | 'order' | 'color'>) => {
    const color = COLOR_PALETTE[projectGroups.length % COLOR_PALETTE.length];
    const newGroup = { ...groupData, id: `group-${Date.now()}`, order: projectGroups.length, color };
    const setter = user ? setFirebaseProjectGroups : setLocalProjectGroups;
    setter(prev => [...prev, newGroup]);
    if (user) {
      try { await setDoc(doc(db, `users/${user.id}/projectGroups/${newGroup.id}`), newGroup); } 
      catch (error) { console.error("Failed to add project group, reverting:", error); setter(prev => prev.filter(g => g.id !== newGroup.id)); }
    }
  }, [user, projectGroups, setFirebaseProjectGroups, setLocalProjectGroups]);

  const updateProjectGroup = useCallback(async (group: ProjectGroup) => {
    const setter = user ? setFirebaseProjectGroups : setLocalProjectGroups;
    setter(prev => prev.map(g => g.id === group.id ? group : g));
    if (user) {
      try { await updateDoc(doc(db, `users/${user.id}/projectGroups/${group.id}`), group); } 
      catch (error) { console.error("Failed to update project group:", error); }
    }
  }, [user, setFirebaseProjectGroups, setLocalProjectGroups]);

  const deleteProjectGroup = useCallback(async (groupId: string) => {
    const setter = user ? setFirebaseProjectGroups : setLocalProjectGroups;
    setter(prev => prev.filter(g => g.id !== groupId));
    if (user) {
      try { await deleteDoc(doc(db, `users/${user.id}/projectGroups/${groupId}`)); } 
      catch (error) { console.error("Failed to delete project group:", error); }
    }
  }, [user, setFirebaseProjectGroups, setLocalProjectGroups]);

  const reorderProjectGroups = useCallback(async (reorderedGroups: ProjectGroup[]) => {
    const updatedGroupsWithOrder = reorderedGroups.map((group, index) => ({ ...group, order: index }));
    const setter = user ? setFirebaseProjectGroups : setLocalProjectGroups;
    setter(updatedGroupsWithOrder);
    if(user) {
        try {
            const batch = writeBatch(db);
            updatedGroupsWithOrder.forEach(group => batch.update(doc(db, `users/${user.id}/projectGroups/${group.id}`), { order: group.order }));
            await batch.commit();
        } catch (error) { console.error("Failed to reorder groups:", error); }
    }
  }, [user, setFirebaseProjectGroups, setLocalProjectGroups]);

  const addTask = useCallback(async (projectId: string, task: Task) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const newTasks = [...(project.tasks || []), task];
    await updateProject(projectId, { tasks: newTasks });
  }, [projects, updateProject]);

  const addSubtask = useCallback(async (projectId: string, parentId: string, subtask: Task) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const newTasks = addSubtaskToTree(project.tasks, parentId, subtask);
    await updateProject(projectId, { tasks: newTasks });
  }, [projects, updateProject]);
  
  const updateTask = useCallback(async (projectId: string, task: Task) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const newTasks = updateTaskInTree(project.tasks, task);
    await updateProject(projectId, { tasks: newTasks });
  }, [projects, updateProject]);

  const updateMultipleTasks = useCallback(async (projectId: string, tasksToUpdate: Task[]) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const newTasks = updateTasksInTree(project.tasks, tasksToUpdate);
    await updateProject(projectId, { tasks: newTasks });
  }, [projects, updateProject]);

  const deleteTask = useCallback(async (projectId: string, taskId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const newTasks = deleteTaskFromTree(project.tasks, taskId);
    await updateProject(projectId, { tasks: newTasks });
  }, [projects, updateProject]);
  
  const moveTask = useCallback(async (sourceProjectId: string, targetProjectId: string, task: Task) => {
      if (sourceProjectId === targetProjectId) return;
      const sourceProject = projects.find(p => p.id === sourceProjectId);
      const targetProject = projects.find(p => p.id === targetProjectId);
      if (!sourceProject || !targetProject) return;
      const { foundTask, newTasks: newSourceTasks } = findAndRemoveTask(sourceProject.tasks, task.id);
      if (foundTask) {
          const newTargetTasks = [...targetProject.tasks, foundTask];
          await Promise.all([ updateProject(sourceProjectId, { tasks: newSourceTasks }), updateProject(targetProjectId, { tasks: newTargetTasks }) ]);
      }
  }, [projects, updateProject]);

  const reparentTask = useCallback(async (projectId: string, taskId: string, newParentId: string | null) => {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;
      const { foundTask, newTasks } = findAndRemoveTask(project.tasks, taskId);
      if (!foundTask) return;
      let finalTasks: Task[];
      if (newParentId === null) finalTasks = [...newTasks, foundTask];
      else finalTasks = addSubtaskToTree(newTasks, newParentId, foundTask);
      await updateProject(projectId, { tasks: finalTasks });
  }, [projects, updateProject]);
  
  const visibleProjects = useMemo(() => projects.filter(p => !p.isArchived).sort((a, b) => {
    const groupA = projectGroups.find(g => g.id === a.groupId)?.order ?? 99;
    const groupB = projectGroups.find(g => g.id === b.groupId)?.order ?? 99;
    if (groupA !== groupB) return groupA - groupB;
    return a.name.localeCompare(b.name);
  }), [projects, projectGroups]);
  const archivedProjects = useMemo(() => projects.filter(p => p.isArchived), [projects]);
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId) ?? null, [projects, selectedProjectId]);

  const contextValue = useMemo(() => ({ projects, visibleProjects, archivedProjects, projectGroups, selectedProjectId, selectedProject, loading, selectProject, addProject, updateProject, deleteProject, archiveProject, unarchiveProject, addProjectGroup, updateProjectGroup, deleteProjectGroup, reorderProjectGroups, addTask, addSubtask, updateTask, updateMultipleTasks, deleteTask, moveTask, reparentTask }), [ projects, visibleProjects, archivedProjects, projectGroups, selectedProjectId, selectedProject, loading, selectProject, addProject, updateProject, deleteProject, archiveProject, unarchiveProject, addProjectGroup, updateProjectGroup, deleteProjectGroup, reorderProjectGroups, addTask, addSubtask, updateTask, updateMultipleTasks, deleteTask, moveTask, reparentTask ]);

  return ( <ProjectContext.Provider value={contextValue}> {children} </ProjectContext.Provider> );
};

export const useProject = (): ProjectContextType => {
  const context = useContext(ProjectContext);
  if (context === undefined) throw new Error('useProject must be used within a ProjectProvider');
  return context;
};

// --- RESOURCE CONTEXT ---

interface ResourceContextType {
  resources: Resource[];
  loading: boolean;
  addResource: (resource: Omit<Resource, 'id'>) => Promise<void>;
  updateResource: (resource: Resource) => Promise<void>;
  deleteResource: (resourceId: string) => Promise<void>;
}

export const ResourceContext = createContext<ResourceContextType | undefined>(undefined);

export const ResourceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [localResources, setLocalResources] = useLocalStorage<Resource[]>('sarted-anonymous-resources', INITIAL_RESOURCES);
  const [firebaseResources, setFirebaseResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  const resources = useMemo(() => (user ? firebaseResources : localResources), [user, firebaseResources, localResources]);

  useEffect(() => {
    if (authLoading) { setLoading(true); setFirebaseResources([]); return; }
    if (user) {
      setLoading(true);
      const resourcesQuery = query(collection(db, `users/${user.id}/resources`), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(resourcesQuery, (snapshot) => {
        const userResources = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Resource));
        setFirebaseResources(userResources);
        setLoading(false);
      }, (error) => { console.error("Error fetching resources:", error); setLoading(false); });
      return () => unsubscribe();
    } else {
      setFirebaseResources([]);
      setLoading(false);
    }
  }, [user, authLoading]);

  const addResource = useCallback(async (resourceData: Omit<Resource, 'id'>) => {
    const newResource: Resource = { ...resourceData, id: `res-${Date.now()}`};
    const setter = user ? setFirebaseResources : setLocalResources;
    setter(prev => [newResource, ...prev]);
    if (user) {
      try { await setDoc(doc(db, `users/${user.id}/resources/${newResource.id}`), newResource); } 
      catch (error) { console.error("Failed to add resource, reverting:", error); setter(prev => prev.filter(r => r.id !== newResource.id)); }
    }
  }, [user, setFirebaseResources, setLocalResources]);
  
  const updateResource = useCallback(async (resource: Resource) => {
    const setter = user ? setFirebaseResources : setLocalResources;
    setter(prev => prev.map(r => r.id === resource.id ? resource : r));
    if (user) {
      try { await updateDoc(doc(db, `users/${user.id}/resources/${resource.id}`), resource); }
      catch (error) { console.error("Failed to update resource:", error); }
    }
  }, [user, setFirebaseResources, setLocalResources]);

  const deleteResource = useCallback(async (resourceId: string) => {
    const setter = user ? setFirebaseResources : setLocalResources;
    setter(prev => prev.filter(r => r.id !== resourceId));
    if (user) {
      try { await deleteDoc(doc(db, `users/${user.id}/resources/${resourceId}`)); }
      catch (error) { console.error("Failed to delete resource:", error); }
    }
  }, [user, setFirebaseResources, setLocalResources]);

  const contextValue = useMemo(() => ({ resources, loading, addResource, updateResource, deleteResource }), [resources, loading, addResource, updateResource, deleteResource]);

  return <ResourceContext.Provider value={contextValue}>{children}</ResourceContext.Provider>;
};

export const useResource = (): ResourceContextType => {
  const context = useContext(ResourceContext);
  if (context === undefined) throw new Error('useResource must be used within a ResourceProvider');
  return context;
};