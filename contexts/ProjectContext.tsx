import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { Project, ProjectGroup, Task, Resource } from '../types';
import { useAuth } from './AuthContext';
import { db } from '../services/firebase';
import { collection, doc, getDocs, query, limit, writeBatch, onSnapshot, orderBy, setDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { INITIAL_PROJECT_GROUPS, INITIAL_PROJECTS, INITIAL_RESOURCES } from '../constants';
import { updateTaskInTree, deleteTaskFromTree, addSubtaskToTree, updateTasksInTree, findAndRemoveTask } from '../utils/taskUtils';

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
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Listen for data changes from Firestore
  useEffect(() => {
    if (authLoading) {
        setLoading(true);
        // Clear out any old data while auth is resolving
        setProjects([]);
        setProjectGroups([]);
        setSelectedProjectId(null);
        return; 
    }

    if (user) {
      setLoading(true);

      const projectsRef = collection(db, `users/${user.id}/projects`);
      getDocs(query(projectsRef, limit(1))).then(snapshot => {
        if (snapshot.empty) {
          console.log("New user project collection is empty. Seeding initial data.");
          const batch = writeBatch(db);
          INITIAL_PROJECT_GROUPS.forEach(group => {
            const groupRef = doc(db, `users/${user.id}/projectGroups/${group.id}`);
            batch.set(groupRef, group);
          });
          INITIAL_PROJECTS.forEach(project => {
            const projectRef = doc(db, `users/${user.id}/projects/${project.id}`);
            batch.set(projectRef, project);
          });
          batch.commit().catch(err => console.error("Failed to seed projects:", err));
        }
      });

      const projectsQuery = collection(db, `users/${user.id}/projects`);
      const groupsQuery = query(collection(db, `users/${user.id}/projectGroups`), orderBy('name'));

      const unsubProjects = onSnapshot(projectsQuery, (snapshot) => {
        const userProjects = snapshot.docs.map(d => {
            const data = d.data();
            if (!data) {
                return { id: d.id, name: 'Invalid Project Data', groupId: '', tasks: [], isArchived: true } as Project;
            }
            // A robust recursive function to ensure task data integrity from Firestore.
            const traverseAndFixTasks = (tasks: any[]): Task[] => {
                if (!Array.isArray(tasks)) return [];
                return tasks.map(t => {
                    if (typeof t !== 'object' || t === null) return null;

                    const subtasks = t.subtasks ? traverseAndFixTasks(t.subtasks) : [];
                    const newTask: Task = {
                        id: t.id || `task-${Date.now()}-${Math.random()}`,
                        name: t.name || 'Untitled Task',
                        description: t.description || '',
                        completed: t.completed ?? false,
                        subtasks: subtasks,
                    };
                    // Add optional fields only if they exist on the source object to preserve them.
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
      }, (error) => console.error("Error fetching projects:", error));
      
      const unsubGroups = onSnapshot(groupsQuery, (snapshot) => {
        const userGroups = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ProjectGroup));

        if (userGroups.length > 0 && userGroups.some(g => g.order === undefined)) {
            console.log("Migrating project groups to include order property...");
            const batch = writeBatch(db);
            userGroups.forEach((group, index) => {
                if (group.order === undefined) {
                    const groupRef = doc(db, `users/${user.id}/projectGroups/${group.id}`);
                    batch.update(groupRef, { order: index });
                }
            });
            batch.commit().catch(err => console.error("Failed to migrate group order:", err));
        } else {
            setProjectGroups(userGroups);
        }

        setLoading(false);
      }, (error) => {
          console.error("Error fetching groups:", error);
          setLoading(false);
      });
      
      return () => { unsubProjects(); unsubGroups(); };
    } else {
      setProjects(INITIAL_PROJECTS);
      setProjectGroups(INITIAL_PROJECT_GROUPS);
      setSelectedProjectId(null);
      setLoading(false);
    }
  }, [user, authLoading]);

  const selectProject = useCallback((id: string | null) => {
    const project = projects.find(p => p.id === id);
    if (project && project.isArchived) {
        return;
    }
    setSelectedProjectId(id);
  }, [projects]);
  
  const addProject = useCallback(async (projectData: Omit<Project, 'id' | 'isArchived'>) => {
    const newProject: Project = { ...projectData, id: `project-${Date.now()}`, isArchived: false};
    const originalProjects = projects;
    setProjects(prev => [...prev, newProject]); // Optimistic update
    selectProject(newProject.id);

    if (user) {
        try {
            await setDoc(doc(db, `users/${user.id}/projects/${newProject.id}`), newProject);
        } catch (error) {
            console.error("Failed to add project, reverting:", error);
            setProjects(originalProjects); // Revert
        }
    }
  }, [projects, user, selectProject]);
  
  const updateProject = useCallback(async (projectId: string, updates: Partial<Omit<Project, 'id'>>) => {
    const originalProjects = projects;
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...updates } as Project : p));

    if (user) {
        try {
            await updateDoc(doc(db, `users/${user.id}/projects/${projectId}`), updates);
        } catch (error) {
            console.error("Failed to update project, reverting:", error);
            setProjects(originalProjects);
        }
    }
  }, [projects, user]);

  const deleteProject = useCallback(async (id: string) => {
    const originalProjects = projects;
    const originalSelectedId = selectedProjectId;
    const remainingProjects = originalProjects.filter(p => p.id !== id);
    let nextSelectedId = selectedProjectId;
    if (selectedProjectId === id) nextSelectedId = null;
    setProjects(remainingProjects);
    if (selectedProjectId === id) selectProject(nextSelectedId);

    if (user) {
        try {
            await deleteDoc(doc(db, `users/${user.id}/projects/${id}`));
        } catch (error) {
            console.error("Failed to delete project, reverting:", error);
            setProjects(originalProjects);
            if(selectedProjectId === id) selectProject(originalSelectedId);
        }
    }
  }, [projects, user, selectedProjectId, selectProject]);
  
  const archiveProject = useCallback(async (projectId: string) => {
      if (selectedProjectId === projectId) selectProject(null);
      await updateProject(projectId, { isArchived: true });
  }, [selectedProjectId, selectProject, updateProject]);

  const unarchiveProject = useCallback(async (projectId: string) => {
      await updateProject(projectId, { isArchived: false });
  }, [updateProject]);

  const addProjectGroup = useCallback(async (groupData: Omit<ProjectGroup, 'id' | 'order'>) => {
    const newGroup = { ...groupData, id: `group-${Date.now()}`, order: projectGroups.length };
    const originalGroups = projectGroups;
    setProjectGroups(prev => [...prev, newGroup]);
    if (user) {
      try {
        await setDoc(doc(db, `users/${user.id}/projectGroups/${newGroup.id}`), newGroup);
      } catch (error) { console.error("Failed to add project group, reverting:", error); setProjectGroups(originalGroups); }
    }
  }, [user, projectGroups]);

  const updateProjectGroup = useCallback(async (group: ProjectGroup) => {
    const originalGroups = projectGroups;
    setProjectGroups(prev => prev.map(g => g.id === group.id ? group : g));
    if (user) {
      try {
        await updateDoc(doc(db, `users/${user.id}/projectGroups/${group.id}`), group);
      } catch (error) { console.error("Failed to update project group, reverting:", error); setProjectGroups(originalGroups); }
    }
  }, [user, projectGroups]);

  const deleteProjectGroup = useCallback(async (groupId: string) => {
    const originalGroups = projectGroups;
    setProjectGroups(prev => prev.filter(g => g.id !== groupId));
    if (user) {
      try {
        await deleteDoc(doc(db, `users/${user.id}/projectGroups/${groupId}`));
      } catch (error) { console.error("Failed to delete project group, reverting:", error); setProjectGroups(originalGroups); }
    }
  }, [user, projectGroups]);

  const reorderProjectGroups = useCallback(async (reorderedGroups: ProjectGroup[]) => {
    const originalGroups = [...projectGroups];
    const updatedGroupsWithOrder = reorderedGroups.map((group, index) => ({ ...group, order: index }));
    setProjectGroups(updatedGroupsWithOrder);
    if(user) {
        try {
            const batch = writeBatch(db);
            updatedGroupsWithOrder.forEach(group => {
                const groupRef = doc(db, `users/${user.id}/projectGroups/${group.id}`);
                batch.update(groupRef, { order: group.order });
            });
            await batch.commit();
        } catch (error) { console.error("Failed to reorder groups, reverting:", error); setProjectGroups(originalGroups); }
    }
  }, [user, projectGroups]);

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

  const importAndOverwriteProjectsAndGroups = useCallback(async (data: { projects: Project[]; projectGroups: ProjectGroup[] }) => {
    if (!user) throw new Error("User must be logged in to import data.");
    
    const CHUNK_SIZE = 400; // Keep it below Firestore's 500 operation limit per batch
    
    // Delete existing projects and groups in chunks
    const projectsRef = collection(db, `users/${user.id}/projects`);
    const groupsRef = collection(db, `users/${user.id}/projectGroups`);
    const [projectsSnapshot, groupsSnapshot] = await Promise.all([getDocs(projectsRef), getDocs(groupsRef)]);
    const docsToDelete = [...projectsSnapshot.docs, ...groupsSnapshot.docs];

    for (let i = 0; i < docsToDelete.length; i += CHUNK_SIZE) {
        const chunk = docsToDelete.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
    
    // Add new projects and groups from backup in chunks
    const groupsToAdd = data.projectGroups.map(g => ({ ref: doc(db, `users/${user.id}/projectGroups/${g.id}`), data: g }));
    const projectsToAdd = data.projects.map(p => ({ ref: doc(db, `users/${user.id}/projects/${p.id}`), data: p }));
    const docsToAdd = [...groupsToAdd, ...projectsToAdd];

    for (let i = 0; i < docsToAdd.length; i += CHUNK_SIZE) {
        const chunk = docsToAdd.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(item => batch.set(item.ref, item.data));
        await batch.commit();
    }
  }, [user]);
  
  const visibleProjects = useMemo(() => projects.filter(p => !p.isArchived), [projects]);
  const archivedProjects = useMemo(() => projects.filter(p => p.isArchived), [projects]);
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId) ?? null, [projects, selectedProjectId]);

  const contextValue = useMemo(() => ({ projects, visibleProjects, archivedProjects, projectGroups, selectedProjectId, selectedProject, loading, selectProject, addProject, updateProject, deleteProject, archiveProject, unarchiveProject, addProjectGroup, updateProjectGroup, deleteProjectGroup, reorderProjectGroups, addTask, addSubtask, updateTask, updateMultipleTasks, deleteTask, moveTask, reparentTask, importAndOverwriteProjectsAndGroups }), [ projects, visibleProjects, archivedProjects, projectGroups, selectedProjectId, selectedProject, loading, selectProject, addProject, updateProject, deleteProject, archiveProject, unarchiveProject, addProjectGroup, updateProjectGroup, deleteProjectGroup, reorderProjectGroups, addTask, addSubtask, updateTask, updateMultipleTasks, deleteTask, moveTask, reparentTask, importAndOverwriteProjectsAndGroups ]);

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
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) { setLoading(true); setResources([]); return; }
    if (user) {
      setLoading(true);
      const resourcesRef = collection(db, `users/${user.id}/resources`);
      getDocs(query(resourcesRef, limit(1))).then(snapshot => {
        if (snapshot.empty) {
          console.log("New user resource collection is empty. Seeding initial data.");
          const batch = writeBatch(db);
          INITIAL_RESOURCES.forEach(resource => batch.set(doc(db, `users/${user.id}/resources/${resource.id}`), resource));
          batch.commit().catch(err => console.error("Failed to seed resources:", err));
        }
      });
      const resourcesQuery = query(collection(db, `users/${user.id}/resources`), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(resourcesQuery, (snapshot) => {
        const userResources = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Resource));
        setResources(userResources);
        setLoading(false);
      }, (error) => { console.error("Error fetching resources:", error); setLoading(false); });
      return () => unsubscribe();
    } else {
      setResources(INITIAL_RESOURCES);
      setLoading(false);
    }
  }, [user, authLoading]);

  const addResource = useCallback(async (resourceData: Omit<Resource, 'id'>) => {
    const newResource: Resource = { ...resourceData, id: `res-${Date.now()}`};
    const originalResources = resources;
    setResources(prev => [newResource, ...prev]);
    if (user) {
      try { await setDoc(doc(db, `users/${user.id}/resources/${newResource.id}`), newResource); } 
      catch (error) { console.error("Failed to add resource, reverting:", error); setResources(originalResources); }
    }
  }, [resources, user]);
  
  const updateResource = useCallback(async (resource: Resource) => {
    const originalResources = resources;
    setResources(prev => prev.map(r => r.id === resource.id ? resource : r));
    if (user) {
      try { await updateDoc(doc(db, `users/${user.id}/resources/${resource.id}`), resource); }
      catch (error) { console.error("Failed to update resource, reverting:", error); setResources(originalResources); }
    }
  }, [resources, user]);

  const deleteResource = useCallback(async (resourceId: string) => {
    const originalResources = resources;
    setResources(prev => prev.filter(r => r.id !== resourceId));
    if (user) {
      try { await deleteDoc(doc(db, `users/${user.id}/resources/${resourceId}`)); }
      catch (error) { console.error("Failed to delete resource, reverting:", error); setResources(originalResources); }
    }
  }, [resources, user]);

  const importAndOverwriteResources = useCallback(async (data: { resources: Resource[] }) => {
    if (!user) throw new Error("User must be logged in to import data.");

    const CHUNK_SIZE = 400;
    const resourcesRef = collection(db, `users/${user.id}/resources`);
    const snapshot = await getDocs(resourcesRef);

    for (let i = 0; i < snapshot.docs.length; i += CHUNK_SIZE) {
        const chunk = snapshot.docs.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }

    for (let i = 0; i < data.resources.length; i += CHUNK_SIZE) {
        const chunk = data.resources.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(resource => {
            const newResourceRef = doc(db, `users/${user.id}/resources/${resource.id}`);
            batch.set(newResourceRef, resource);
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