import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { Project, ProjectGroup, Task, Resource } from '../types';
import { useAuth } from './AuthContext';
import { db } from '../services/firebase';
import { INITIAL_PROJECT_GROUPS, INITIAL_PROJECTS, INITIAL_RESOURCES } from '../constants';
import { updateTaskInTree, deleteTaskFromTree, addSubtaskToTree, updateTasksInTree, findAndRemoveTask } from '../utils/taskUtils';

// --- PROJECT CONTEXT ---

interface ProjectContextType {
  projects: Project[];
  visibleProjects: Project[]; // Filtered based on `showHidden`
  projectGroups: ProjectGroup[];
  selectedProjectId: string | null;
  selectedProject: Project | null;
  loading: boolean;
  showHiddenProjects: boolean;
  setShowHiddenProjects: (show: boolean) => void;
  selectProject: (id: string | null) => void;
  addProject: (project: Omit<Project, 'id' | 'isHidden'>) => Promise<void>;
  updateProject: (projectId: string, updates: Partial<Omit<Project, 'id'>>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  toggleProjectVisibility: (id: string, isHidden: boolean) => Promise<void>;
  addProjectGroup: (group: Omit<ProjectGroup, 'id'>) => Promise<void>;
  updateProjectGroup: (group: ProjectGroup) => Promise<void>;
  deleteProjectGroup: (groupId: string) => Promise<void>;
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHiddenProjects, setShowHiddenProjects] = useState(false);

  // Seed initial data for new users
  useEffect(() => {
    if (user) {
      const userDocRef = db.doc(`users/${user.id}`);
      userDocRef.get().then(docSnap => {
        if (!docSnap.exists) { // Only seed if the user document itself doesn't exist
            const projectColRef = db.collection(`users/${user.id}/projects`);
            projectColRef.get().then(projectSnap => {
                if (projectSnap.empty) {
                    console.log("New user detected, seeding project data...");
                    const batch = db.batch();
                    batch.set(userDocRef, { projectSeeded: true }, { merge: true });
                    INITIAL_PROJECT_GROUPS.forEach(group => {
                        const groupRef = db.doc(`users/${user.id}/projectGroups/${group.id}`);
                        batch.set(groupRef, group);
                    });
                    INITIAL_PROJECTS.forEach(project => {
                        const projectRef = db.doc(`users/${user.id}/projects/${project.id}`);
                        batch.set(projectRef, { ...project, isHidden: false });
                    });
                    batch.commit();
                }
            });
        }
      });
    }
  }, [user]);
  
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
      const projectsQuery = db.collection(`users/${user.id}/projects`);
      const groupsQuery = db.collection(`users/${user.id}/projectGroups`);

      const unsubProjects = projectsQuery.onSnapshot((snapshot) => {
        const userProjects = snapshot.docs.map(d => {
            const data = d.data();
            if (!data) {
                return { id: d.id, name: 'Invalid Project Data', groupId: '', tasks: [], isHidden: true } as Project;
            }
            const traverseAndFixTasks = (tasks: any[]): Task[] => {
                if (!Array.isArray(tasks)) return [];
                return tasks.map(t => ({
                    ...t,
                    id: t.id || `task-${Math.random()}`,
                    name: t.name || 'Untitled Task',
                    completed: t.completed ?? false,
                    description: t.description || '',
                    subtasks: traverseAndFixTasks(t.subtasks)
                }));
            }
            return {
                id: d.id,
                name: data.name || 'Untitled Project',
                groupId: data.groupId || '',
                tasks: traverseAndFixTasks(data.tasks),
                isHidden: data.isHidden ?? false,
                icon: data.icon, // Ensure icon is loaded
            } as Project;
        });
        setProjects(userProjects);
      }, (error) => console.error("Error fetching projects:", error));
      
      const unsubGroups = groupsQuery.onSnapshot((snapshot) => {
        const userGroups = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ProjectGroup));
        setProjectGroups(userGroups);
        setLoading(false);
      }, (error) => {
          console.error("Error fetching groups:", error);
          setLoading(false);
      });

      const settingsRef = db.doc(`users/${user.id}/settings/main`);
      const unsubSettings = settingsRef.onSnapshot((docSnap) => {
        if (docSnap.exists) {
            setSelectedProjectId(docSnap.data()?.selectedProjectId || null);
        }
      }, (error) => console.error("Error fetching settings:", error));
      
      return () => { unsubProjects(); unsubGroups(); unsubSettings(); };
    } else {
      // Not logged in, show initial data
      setProjects(INITIAL_PROJECTS);
      setProjectGroups(INITIAL_PROJECT_GROUPS);
      setSelectedProjectId(INITIAL_PROJECTS.length > 0 ? INITIAL_PROJECTS[0].id : null);
      setLoading(false);
    }
  }, [user, authLoading]);

  const selectProject = useCallback(async (id: string | null) => {
    setSelectedProjectId(id);
    if (user) {
      try {
        const settingsRef = db.doc(`users/${user.id}/settings/main`);
        await settingsRef.set({ selectedProjectId: id }, { merge: true });
      } catch (error) {
        console.error("Failed to save selected project:", error);
      }
    }
  }, [user]);

  const addProject = useCallback(async (projectData: Omit<Project, 'id' | 'isHidden'>) => {
    const newProject: Project = { ...projectData, id: `project-${Date.now()}`, isHidden: false};
    const originalProjects = projects;
    setProjects(prev => [...prev, newProject]); // Optimistic update
    await selectProject(newProject.id);

    if (user) {
        try {
            await db.doc(`users/${user.id}/projects/${newProject.id}`).set(newProject);
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
            await db.doc(`users/${user.id}/projects/${projectId}`).update(updates);
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

    if (selectedProjectId === id) {
        nextSelectedId = remainingProjects.length > 0 ? remainingProjects[0].id : null;
    }

    setProjects(remainingProjects);
    if (selectedProjectId === id) {
        await selectProject(nextSelectedId);
    }

    if (user) {
        try {
            await db.doc(`users/${user.id}/projects/${id}`).delete();
        } catch (error) {
            console.error("Failed to delete project, reverting:", error);
            setProjects(originalProjects);
            if(selectedProjectId === id) await selectProject(originalSelectedId);
        }
    }
  }, [projects, user, selectedProjectId, selectProject]);
  
  const toggleProjectVisibility = useCallback(async (id: string, isHidden: boolean) => {
    const originalProjects = projects;
    const originalSelectedId = selectedProjectId;

    setProjects(prev => prev.map(p => p.id === id ? { ...p, isHidden } : p));
    if (isHidden && selectedProjectId === id) {
        await selectProject(null);
    }

    if (user) {
        try {
            await db.doc(`users/${user.id}/projects/${id}`).update({ isHidden });
        } catch (error) {
            console.error("Failed to update project visibility, reverting:", error);
            setProjects(originalProjects);
            if (isHidden && originalSelectedId === id) {
                 await selectProject(originalSelectedId);
            }
        }
    }
}, [projects, user, selectedProjectId, selectProject]);

  const addProjectGroup = useCallback(async (groupData: Omit<ProjectGroup, 'id'>) => {
    if (!user) return;
    try {
      await db.collection(`users/${user.id}/projectGroups`).add(groupData);
    } catch (error) {
      console.error("Failed to add project group:", error);
    }
  }, [user]);
  
  const updateProjectGroup = useCallback(async (group: ProjectGroup) => {
    if (!user) return;
    try {
      await db.doc(`users/${user.id}/projectGroups/${group.id}`).set(group);
    } catch (error) {
      console.error("Failed to update project group:", error);
    }
  }, [user]);

  const deleteProjectGroup = useCallback(async (groupId: string) => {
    if (!user) return;
    try {
      await db.doc(`users/${user.id}/projectGroups/${groupId}`).delete();
    } catch (error) {
      console.error("Failed to delete project group:", error);
    }
  }, [user]);


  const updateProjectTasks = useCallback(async (projectId: string, getNewTasks: (tasks: Task[]) => Task[]) => {
    const originalProjects = projects;
    const project = originalProjects.find(p => p.id === projectId);
    if (!project) return;
    
    const newTasks = getNewTasks(project.tasks);
    const newProjects = originalProjects.map(p => p.id === projectId ? { ...p, tasks: newTasks } : p);
    setProjects(newProjects);

    if (user) {
      try {
        const projectRef = db.doc(`users/${user.id}/projects/${projectId}`);
        await projectRef.update({ tasks: newTasks });
      } catch (error) {
        console.error("Failed to update tasks, reverting:", error);
        setProjects(originalProjects);
      }
    }
  }, [projects, user]);

  const addTask = useCallback((projectId: string, task: Task) => 
    updateProjectTasks(projectId, (tasks) => [...tasks, task]),
  [updateProjectTasks]);
  
  const addSubtask = useCallback((projectId: string, parentId: string, subtask: Task) => 
    updateProjectTasks(projectId, (tasks) => addSubtaskToTree(tasks, parentId, subtask)),
  [updateProjectTasks]);

  const updateTask = useCallback((projectId: string, task: Task) => 
    updateProjectTasks(projectId, (tasks) => updateTaskInTree(tasks, task)),
  [updateProjectTasks]);
  
  const updateMultipleTasks = useCallback((projectId: string, tasksToUpdate: Task[]) => 
    updateProjectTasks(projectId, (tasks) => updateTasksInTree(tasks, tasksToUpdate)),
  [updateProjectTasks]);

  const deleteTask = useCallback((projectId: string, taskId: string) => 
    updateProjectTasks(projectId, (tasks) => deleteTaskFromTree(tasks, taskId)),
  [updateProjectTasks]);
  
  const moveTask = useCallback(async (sourceProjectId: string, targetProjectId: string, task: Task) => {
    if (!user || sourceProjectId === targetProjectId) return;
    
    const originalProjects = projects;
    const sourceProject = originalProjects.find(p => p.id === sourceProjectId);
    const targetProject = originalProjects.find(p => p.id === targetProjectId);
    if (!sourceProject || !targetProject) return;

    const newSourceTasks = deleteTaskFromTree(sourceProject.tasks, task.id);
    const newTargetTasks = [...targetProject.tasks, task];
    const newProjects = originalProjects.map(p => {
        if (p.id === sourceProjectId) return { ...p, tasks: newSourceTasks };
        if (p.id === targetProjectId) return { ...p, tasks: newTargetTasks };
        return p;
    });
    setProjects(newProjects);

    try {
        const batch = db.batch();
        const sourceRef = db.doc(`users/${user.id}/projects/${sourceProjectId}`);
        batch.update(sourceRef, { tasks: newSourceTasks });
        const targetRef = db.doc(`users/${user.id}/projects/${targetProjectId}`);
        batch.update(targetRef, { tasks: newTargetTasks });
        await batch.commit();
    } catch (error) {
        console.error("Failed to move task, reverting:", error);
        setProjects(originalProjects);
    }
  }, [projects, user]);

  const reparentTask = useCallback(async (projectId: string, taskId: string, newParentId: string | null) => {
      await updateProjectTasks(projectId, (currentTasks) => {
          const { foundTask, newTasks: treeWithoutTask } = findAndRemoveTask(currentTasks, taskId);
          if (!foundTask) return currentTasks;
          
          if (newParentId === null) {
              return [...treeWithoutTask, foundTask];
          } else {
              return addSubtaskToTree(treeWithoutTask, newParentId, foundTask);
          }
      });
  }, [updateProjectTasks]);

  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId) || null, [projects, selectedProjectId]);
  
  const visibleProjects = useMemo(() => {
    return projects.filter(p => !p.isHidden || showHiddenProjects);
  }, [projects, showHiddenProjects]);

  const contextValue = useMemo(() => ({
    projects, visibleProjects, projectGroups, selectedProjectId, selectedProject, loading, showHiddenProjects, setShowHiddenProjects,
    selectProject, addProject, updateProject, deleteProject, toggleProjectVisibility, addProjectGroup, updateProjectGroup, deleteProjectGroup,
    addTask, addSubtask, updateTask, updateMultipleTasks, deleteTask, moveTask,
    reparentTask
  }), [projects, visibleProjects, projectGroups, selectedProjectId, selectedProject, loading, showHiddenProjects, selectProject, addProject, updateProject, deleteProject, toggleProjectVisibility, addProjectGroup, updateProjectGroup, deleteProjectGroup, addTask, addSubtask, updateTask, updateMultipleTasks, deleteTask, moveTask, reparentTask]);

  return <ProjectContext.Provider value={contextValue}>{children}</ProjectContext.Provider>;
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
    deleteResource: (id: string) => Promise<void>;
}

export const ResourceContext = createContext<ResourceContextType | undefined>(undefined);

export const ResourceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, loading: authLoading } = useAuth();
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      if (user) {
        const userDocRef = db.doc(`users/${user.id}`);
        userDocRef.get().then(docSnap => {
          if (!docSnap.exists) { // Only seed if the user document itself doesn't exist
              const resourceColRef = db.collection(`users/${user.id}/resources`);
              resourceColRef.get().then(resourceSnap => {
                  if (resourceSnap.empty) {
                      console.log("New user detected, seeding resource data...");
                      const batch = db.batch();
                      batch.set(userDocRef, { resourceSeeded: true }, { merge: true });
                      INITIAL_RESOURCES.forEach(resource => {
                          const resourceRef = db.doc(`users/${user.id}/resources/${resource.id}`);
                          batch.set(resourceRef, resource);
                      });
                      batch.commit();
                  }
              });
          }
        });
      }
    }, [user]);

    useEffect(() => {
        if (authLoading) {
            setLoading(true);
            setResources([]);
            return;
        }
        if (user) {
            setLoading(true);
            const resourcesQuery = db.collection(`users/${user.id}/resources`).orderBy('createdAt', 'desc');
            const unsubscribe = resourcesQuery.onSnapshot(snapshot => {
                const userResources = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Resource));
                setResources(userResources);
                setLoading(false);
            }, (error) => {
                console.error("Error fetching resources:", error);
                setLoading(false);
            });
            return () => unsubscribe();
        } else {
            setResources(INITIAL_RESOURCES);
            setLoading(false);
        }
    }, [user, authLoading]);

    const addResource = useCallback(async (resourceData: Omit<Resource, 'id'>) => {
        const newResource: Resource = { ...resourceData, id: `res-${Date.now()}` };
        setResources(prev => [newResource, ...prev]); // Optimistic update

        if (user) {
            try {
                await db.doc(`users/${user.id}/resources/${newResource.id}`).set(newResource);
            } catch (error) {
                console.error("Failed to add resource, reverting:", error);
                setResources(prev => prev.filter(r => r.id !== newResource.id));
            }
        }
    }, [user]);

    const updateResource = useCallback(async (resource: Resource) => {
        setResources(prev => prev.map(r => r.id === resource.id ? resource : r)); // Optimistic

        if (user) {
            try {
                await db.doc(`users/${user.id}/resources/${resource.id}`).set(resource, { merge: true });
            } catch (error) {
                console.error("Failed to update resource:", error);
                // Simple revert for now. A more robust solution would re-fetch.
                const original = resources.find(r => r.id === resource.id);
                if (original) setResources(prev => prev.map(r => r.id === resource.id ? original : r));
            }
        }
    }, [user, resources]);

    const deleteResource = useCallback(async (id: string) => {
        const originalResources = resources;
        setResources(prev => prev.filter(r => r.id !== id)); // Optimistic

        if (user) {
            try {
                await db.doc(`users/${user.id}/resources/${id}`).delete();
            } catch (error) {
                console.error("Failed to delete resource, reverting:", error);
                setResources(originalResources);
            }
        }
    }, [user, resources]);
    
    const contextValue = useMemo(() => ({
        resources, loading, addResource, updateResource, deleteResource
    }), [resources, loading, addResource, updateResource, deleteResource]);

    return <ResourceContext.Provider value={contextValue}>{children}</ResourceContext.Provider>;
};

export const useResource = (): ResourceContextType => {
    const context = useContext(ResourceContext);
    if (context === undefined) throw new Error('useResource must be used within a ResourceProvider');
    return context;
};