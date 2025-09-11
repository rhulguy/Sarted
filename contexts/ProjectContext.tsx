import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { Project, ProjectGroup, Task, Resource, ApiError } from '../types';
import { useAuth } from './AuthContext';
import { db } from '../services/firebase';
import firebase from 'firebase/compat/app';
import { INITIAL_PROJECT_GROUPS, INITIAL_PROJECTS, INITIAL_RESOURCES } from '../constants';
import { updateTaskInTree, deleteTaskFromTree, addSubtaskToTree, updateTasksInTree, findAndRemoveTask } from '../utils/taskUtils';
import { useNotification } from './NotificationContext';

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
  addProjectGroup: (group: Omit<ProjectGroup, 'id' | 'order'>) => Promise<void>;
  updateProjectGroup: (group: ProjectGroup) => Promise<void>;
  deleteProjectGroup: (groupId: string) => Promise<void>;
  reorderProjectGroups: (groups: ProjectGroup[]) => Promise<void>;
  addTask: (projectId: string, task: Task) => Promise<void>;
  addMultipleTasks: (projectId: string, tasks: Task[]) => Promise<void>;
  addSubtask: (projectId: string, parentId: string, subtask: Task) => Promise<void>;
  updateTask: (projectId: string, task: Task) => Promise<void>;
  updateMultipleTasks: (projectId: string, tasks: Task[]) => Promise<void>;
  deleteTask: (projectId: string, taskId: string) => Promise<void>;
  moveTask: (sourceProjectId: string, targetProjectId: string, task: Task) => Promise<void>;
  reparentTask: (projectId: string, taskId: string, newParentId: string | null) => Promise<void>;
  importAndOverwriteProjectsAndGroups: (data: { projects: Project[]; projectGroups: ProjectGroup[] }) => Promise<void>;
}

export const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { showNotification } = useNotification();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // State to track if the initial data load has completed for each listener.
  // This is crucial to prevent race conditions where UI actions happen on partially loaded data.
  const [initialProjectsLoaded, setInitialProjectsLoaded] = useState(false);
  const [initialGroupsLoaded, setInitialGroupsLoaded] = useState(false);

  useEffect(() => {
    if (authLoading) {
        setLoading(true);
        setProjects([]);
        setProjectGroups([]);
        setSelectedProjectId(null);
        setInitialProjectsLoaded(false);
        setInitialGroupsLoaded(false);
        return; 
    }

    if (user) {
      setLoading(true);
      setInitialProjectsLoaded(false);
      setInitialGroupsLoaded(false);

      const projectsRef = db.collection(`users/${user.id}/projects`);
      projectsRef.limit(1).get().then(snapshot => {
        if (snapshot.empty) {
          const batch = db.batch();
          INITIAL_PROJECT_GROUPS.forEach(group => batch.set(db.doc(`users/${user.id}/projectGroups/${group.id}`), group));
          INITIAL_PROJECTS.forEach(project => batch.set(db.doc(`users/${user.id}/projects/${project.id}`), project));
          batch.commit().catch(err => showNotification({ message: "Failed to create initial data.", type: "error"}));
        }
      });

      const projectsQuery = db.collection(`users/${user.id}/projects`);
      const groupsQuery = db.collection(`users/${user.id}/projectGroups`).orderBy('order');

      const unsubProjects = projectsQuery.onSnapshot((snapshot) => {
        const userProjects = snapshot.docs.map(d => {
            const data = d.data();
            const traverseAndFixTasks = (tasks: any[]): Task[] => {
                if (!Array.isArray(tasks)) return [];
                return tasks.map(t => {
                    if (typeof t !== 'object' || t === null) return null;
                    const subtasks = t.subtasks ? traverseAndFixTasks(t.subtasks) : [];
                    const newTask: Task = {
                        id: t.id || `task-${Date.now()}-${Math.random()}`, name: t.name || 'Untitled Task',
                        description: t.description || '', completed: t.completed ?? false, subtasks: subtasks,
                    };
                    if (t.completionDate) newTask.completionDate = t.completionDate;
                    if (t.startDate) newTask.startDate = t.startDate;
                    if (t.endDate) newTask.endDate = t.endDate;
                    if (t.dependencies) newTask.dependencies = t.dependencies;
                    if (t.imageUrl) newTask.imageUrl = t.imageUrl;
                    if (t.resourceIds) newTask.resourceIds = t.resourceIds;
                    if (t.startTime) newTask.startTime = t.startTime;
                    if (t.duration) newTask.duration = t.duration;
                    return newTask;
                }).filter((t): t is Task => t !== null);
            };
            return { id: d.id, name: data.name || 'Untitled Project', groupId: data.groupId || '', tasks: traverseAndFixTasks(data.tasks), isArchived: data.isArchived ?? false, icon: data.icon, dreamBoardImages: data.dreamBoardImages } as Project;
        });
        setProjects(userProjects);
        setInitialProjectsLoaded(true);
      }, (error) => {
          showNotification({ message: "Error fetching projects.", type: "error"});
          setInitialProjectsLoaded(true); // Mark as loaded even on error to prevent indefinite loading state
      });
      
      const unsubGroups = groupsQuery.onSnapshot((snapshot) => {
        const userGroups = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ProjectGroup));
        setProjectGroups(userGroups);
        setInitialGroupsLoaded(true);
      }, (error) => { 
          showNotification({ message: "Error fetching project groups.", type: "error"}); 
          setInitialGroupsLoaded(true); // Mark as loaded even on error
      });
      
      return () => { unsubProjects(); unsubGroups(); };
    } else {
      setProjects(INITIAL_PROJECTS);
      setProjectGroups(INITIAL_PROJECT_GROUPS);
      setSelectedProjectId(null);
      setLoading(false);
    }
  }, [user, authLoading, showNotification]);

  // This effect synchronizes the final loading state. The context is only considered "loaded"
  // when both initial project and group fetches have completed.
  useEffect(() => {
      if (user) {
        if (initialProjectsLoaded && initialGroupsLoaded) {
            setLoading(false);
        }
      }
  }, [user, initialProjectsLoaded, initialGroupsLoaded]);

  const selectProject = useCallback((id: string | null) => {
    const project = projects.find(p => p.id === id);
    if (project && project.isArchived) return;
    setSelectedProjectId(id);
  }, [projects]);
  
  const addProject = useCallback(async (projectData: Omit<Project, 'id' | 'isArchived'>) => {
    const newProject: Project = { ...projectData, id: `project-${Date.now()}`, isArchived: false};
    setProjects(prev => [...prev, newProject]); 
    selectProject(newProject.id);

    if (user) {
        try {
            await db.doc(`users/${user.id}/projects/${newProject.id}`).set(newProject);
            showNotification({ message: `Project "${newProject.name}" created.`, type: 'success' });
        } catch (error) {
            showNotification({ message: "Failed to save new project.", type: "error" });
            setProjects(prev => prev.filter(p => p.id !== newProject.id)); // Revert
        }
    }
  }, [user, selectProject, showNotification]);
  
  const updateProject = useCallback(async (projectId: string, updates: Partial<Omit<Project, 'id'>>) => {
    if (user) {
        try {
            await db.doc(`users/${user.id}/projects/${projectId}`).update(updates);
        } catch (error) {
            showNotification({ message: "Failed to update project.", type: "error" });
        }
    } else { // Handle local state update for anonymous users
         setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...updates } as Project : p));
    }
  }, [user, showNotification]);

  const deleteProject = useCallback(async (id: string) => {
    if (selectedProjectId === id) selectProject(null);
    if (user) {
        try {
            await db.doc(`users/${user.id}/projects/${id}`).delete();
            showNotification({ message: "Project deleted.", type: "success" });
        } catch (error) {
            showNotification({ message: "Failed to delete project.", type: "error" });
        }
    } else {
        setProjects(prev => prev.filter(p => p.id !== id));
    }
  }, [user, selectedProjectId, selectProject, showNotification]);
  
  const archiveProject = useCallback(async (projectId: string) => {
      if (selectedProjectId === projectId) selectProject(null);
      await updateProject(projectId, { isArchived: true });
      showNotification({ message: "Project archived.", type: 'info' });
  }, [selectedProjectId, selectProject, updateProject, showNotification]);

  const unarchiveProject = useCallback(async (projectId: string) => {
      await updateProject(projectId, { isArchived: false });
      showNotification({ message: "Project restored.", type: 'success' });
  }, [updateProject, showNotification]);

  const addProjectGroup = useCallback(async (groupData: Omit<ProjectGroup, 'id' | 'order'>) => {
    const newGroup = { ...groupData, id: `group-${Date.now()}`, order: projectGroups.length };
    if (user) {
      try {
        await db.doc(`users/${user.id}/projectGroups/${newGroup.id}`).set(newGroup);
        showNotification({ message: `Group "${newGroup.name}" created.`, type: 'success' });
      } catch (error) { showNotification({ message: "Failed to add project group.", type: 'error' }); }
    } else {
        setProjectGroups(prev => [...prev, newGroup]);
    }
  }, [user, projectGroups.length, showNotification]);

  const updateProjectGroup = useCallback(async (group: ProjectGroup) => {
    if (user) {
      try {
        await db.doc(`users/${user.id}/projectGroups/${group.id}`).update(group);
      } catch (error) { showNotification({ message: "Failed to update group.", type: 'error' }); }
    } else {
        setProjectGroups(prev => prev.map(g => g.id === group.id ? group : g));
    }
  }, [user, showNotification]);

  const deleteProjectGroup = useCallback(async (groupId: string) => {
    if (user) {
      try {
        await db.doc(`users/${user.id}/projectGroups/${groupId}`).delete();
        showNotification({ message: "Group deleted.", type: 'success' });
      } catch (error) { showNotification({ message: "Failed to delete group.", type: 'error' }); }
    } else {
        setProjectGroups(prev => prev.filter(g => g.id !== groupId));
    }
  }, [user, showNotification]);

  const reorderProjectGroups = useCallback(async (reorderedGroups: ProjectGroup[]) => {
    const updatedGroupsWithOrder = reorderedGroups.map((group, index) => ({ ...group, order: index }));
    if(user) {
        try {
            const batch = db.batch();
            updatedGroupsWithOrder.forEach(group => {
                const groupRef = db.doc(`users/${user.id}/projectGroups/${group.id}`);
                batch.update(groupRef, { order: group.order });
            });
            await batch.commit();
        } catch (error) { showNotification({ message: "Failed to reorder groups.", type: 'error' }); }
    } else {
        setProjectGroups(updatedGroupsWithOrder);
    }
  }, [user, showNotification]);

  const addTask = useCallback(async (projectId: string, task: Task) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const newTasks = [...(project.tasks || []), task];
    await updateProject(projectId, { tasks: newTasks });
  }, [projects, updateProject]);
  
  const addMultipleTasks = useCallback(async (projectId: string, tasks: Task[]) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const newTasks = [...(project.tasks || []), ...tasks];
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
          showNotification({ message: `Task moved to "${targetProject.name}".`, type: 'success'});
      }
  }, [projects, updateProject, showNotification]);

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

  const importAndOverwriteProjectsAndGroups = useCallback(async (data: { projects: Project[]; projectGroups: ProjectGroup[] }) => {
    if (!user) throw new Error("User must be logged in to import data.");
    const CHUNK_SIZE = 400; 
    const projectsRef = db.collection(`users/${user.id}/projects`);
    const groupsRef = db.collection(`users/${user.id}/projectGroups`);
    const [projectsSnapshot, groupsSnapshot] = await Promise.all([projectsRef.get(), groupsRef.get()]);
    const docsToDelete = [...projectsSnapshot.docs, ...groupsSnapshot.docs];

    for (let i = 0; i < docsToDelete.length; i += CHUNK_SIZE) {
        const batch = db.batch();
        docsToDelete.slice(i, i + CHUNK_SIZE).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
    
    const groupsToAdd = data.projectGroups.map(g => ({ ref: db.doc(`users/${user.id}/projectGroups/${g.id}`), data: g }));
    const projectsToAdd = data.projects.map(p => ({ ref: db.doc(`users/${user.id}/projects/${p.id}`), data: p }));
    const docsToAdd = [...groupsToAdd, ...projectsToAdd];

    for (let i = 0; i < docsToAdd.length; i += CHUNK_SIZE) {
        const batch = db.batch();
        docsToAdd.slice(i, i + CHUNK_SIZE).forEach(item => batch.set(item.ref, item.data));
        await batch.commit();
    }
  }, [user]);
  
  const visibleProjects = useMemo(() => projects.filter(p => !p.isArchived), [projects]);
  const archivedProjects = useMemo(() => projects.filter(p => p.isArchived), [projects]);
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId) ?? null, [projects, selectedProjectId]);

  const contextValue = useMemo(() => ({ projects, visibleProjects, archivedProjects, projectGroups, selectedProjectId, selectedProject, loading, selectProject, addProject, updateProject, deleteProject, archiveProject, unarchiveProject, addProjectGroup, updateProjectGroup, deleteProjectGroup, reorderProjectGroups, addTask, addMultipleTasks, addSubtask, updateTask, updateMultipleTasks, deleteTask, moveTask, reparentTask, importAndOverwriteProjectsAndGroups }), [ projects, visibleProjects, archivedProjects, projectGroups, selectedProjectId, selectedProject, loading, selectProject, addProject, updateProject, deleteProject, archiveProject, unarchiveProject, addProjectGroup, updateProjectGroup, deleteProjectGroup, reorderProjectGroups, addTask, addMultipleTasks, addSubtask, updateTask, updateMultipleTasks, deleteTask, moveTask, reparentTask, importAndOverwriteProjectsAndGroups ]);

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
  importAndOverwriteResources: (data: { resources: Resource[] }) => Promise<void>;
}

export const ResourceContext = createContext<ResourceContextType | undefined>(undefined);

export const ResourceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { showNotification } = useNotification();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) { setLoading(true); setResources([]); return; }
    if (user) {
      setLoading(true);
      const resourcesRef = db.collection(`users/${user.id}/resources`);
      resourcesRef.limit(1).get().then(snapshot => {
        if (snapshot.empty) {
          const batch = db.batch();
          INITIAL_RESOURCES.forEach(resource => batch.set(db.doc(`users/${user.id}/resources/${resource.id}`), resource));
          batch.commit().catch(err => showNotification({ message: "Failed to create initial resources.", type: 'error' }));
        }
      });
      const resourcesQuery = db.collection(`users/${user.id}/resources`).orderBy('createdAt', 'desc');
      const unsubscribe = resourcesQuery.onSnapshot((snapshot) => {
        const userResources = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Resource));
        setResources(userResources);
        setLoading(false);
      }, (error) => { showNotification({ message: "Error fetching resources.", type: 'error' }); setLoading(false); });
      return () => unsubscribe();
    } else {
      setResources(INITIAL_RESOURCES);
      setLoading(false);
    }
  }, [user, authLoading, showNotification]);

  const addResource = useCallback(async (resourceData: Omit<Resource, 'id'>) => {
    const newResource: Resource = { ...resourceData, id: `res-${Date.now()}`};
    if (user) {
      try { 
        await db.doc(`users/${user.id}/resources/${newResource.id}`).set(newResource); 
        showNotification({ message: `Resource "${newResource.title}" added.`, type: 'success'});
      } 
      catch (error) { showNotification({ message: "Failed to add resource.", type: 'error' }); }
    } else {
      setResources(prev => [newResource, ...prev]);
    }
  }, [user, showNotification]);
  
  const updateResource = useCallback(async (resource: Resource) => {
    if (user) {
      try { await db.doc(`users/${user.id}/resources/${resource.id}`).update(resource); }
      catch (error) { showNotification({ message: "Failed to update resource.", type: 'error' }); }
    } else {
       setResources(prev => prev.map(r => r.id === resource.id ? resource : r));
    }
  }, [user, showNotification]);

  const deleteResource = useCallback(async (resourceId: string) => {
    if (user) {
      try { 
          await db.doc(`users/${user.id}/resources/${resourceId}`).delete();
          showNotification({ message: 'Resource deleted.', type: 'success' });
      }
      catch (error) { showNotification({ message: "Failed to delete resource.", type: 'error' }); }
    } else {
        setResources(prev => prev.filter(r => r.id !== resourceId));
    }
  }, [user, showNotification]);

  const importAndOverwriteResources = useCallback(async (data: { resources: Resource[] }) => {
    if (!user) throw new Error("User must be logged in to import data.");
    const CHUNK_SIZE = 400;
    const resourcesRef = db.collection(`users/${user.id}/resources`);
    const snapshot = await resourcesRef.get();

    for (let i = 0; i < snapshot.docs.length; i += CHUNK_SIZE) {
        const batch = db.batch();
        snapshot.docs.slice(i, i + CHUNK_SIZE).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
    for (let i = 0; i < data.resources.length; i += CHUNK_SIZE) {
        const batch = db.batch();
        data.resources.slice(i, i + CHUNK_SIZE).forEach(resource => {
            batch.set(db.doc(`users/${user.id}/resources/${resource.id}`), resource);
        });
        await batch.commit();
    }
  }, [user]);

  const contextValue = useMemo(() => ({ resources, loading, addResource, updateResource, deleteResource, importAndOverwriteResources }), [resources, loading, addResource, updateResource, deleteResource, importAndOverwriteResources]);

  return <ResourceContext.Provider value={contextValue}>{children}</ResourceContext.Provider>;
};

export const useResource = (): ResourceContextType => {
  const context = useContext(ResourceContext);
  if (context === undefined) throw new Error('useResource must be used within a ResourceProvider');
  return context;
};
