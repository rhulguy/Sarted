import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { Project, ProjectGroup, Task, Resource } from '../types';
import { useAuth } from './AuthContext';
import { db } from '../services/firebase';
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

      // --- Robust Seeding Logic ---
      const projectsRef = db.collection(`users/${user.id}/projects`);
      projectsRef.limit(1).get().then(snapshot => {
        if (snapshot.empty) {
          console.log("New user project collection is empty. Seeding initial data.");
          const batch = db.batch();
          INITIAL_PROJECT_GROUPS.forEach(group => {
            const groupRef = db.doc(`users/${user.id}/projectGroups/${group.id}`);
            batch.set(groupRef, group);
          });
          INITIAL_PROJECTS.forEach(project => {
            const projectRef = db.doc(`users/${user.id}/projects/${project.id}`);
            batch.set(projectRef, project);
          });
          batch.commit().catch(err => console.error("Failed to seed projects:", err));
        }
      });
      // --- End Seeding Logic ---

      const projectsQuery = db.collection(`users/${user.id}/projects`);
      const groupsQuery = db.collection(`users/${user.id}/projectGroups`);

      const unsubProjects = projectsQuery.onSnapshot((snapshot) => {
        const userProjects = snapshot.docs.map(d => {
            const data = d.data();
            if (!data) {
                return { id: d.id, name: 'Invalid Project Data', groupId: '', tasks: [], isArchived: true } as Project;
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
                isArchived: data.isArchived ?? false,
                icon: data.icon,
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
      
      return () => { unsubProjects(); unsubGroups(); };
    } else {
      // Not logged in, show initial data
      setProjects(INITIAL_PROJECTS);
      setProjectGroups(INITIAL_PROJECT_GROUPS);
      setSelectedProjectId(null);
      setLoading(false);
    }
  }, [user, authLoading]);

  const selectProject = useCallback((id: string | null) => {
    const project = projects.find(p => p.id === id);
    if (project && project.isArchived) {
        // Do not allow selecting an archived project.
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
        nextSelectedId = null; // Go to dashboard view
    }

    setProjects(remainingProjects);
    if (selectedProjectId === id) {
        selectProject(nextSelectedId);
    }

    if (user) {
        try {
            await db.doc(`users/${user.id}/projects/${id}`).delete();
        } catch (error) {
            console.error("Failed to delete project, reverting:", error);
            setProjects(originalProjects);
            if(selectedProjectId === id) selectProject(originalSelectedId);
        }
    }
  }, [projects, user, selectedProjectId, selectProject]);
  
  const archiveProject = useCallback(async (projectId: string) => {
      // Step 1: Safely deselect the project if it's currently selected.
      if (selectedProjectId === projectId) {
          selectProject(null);
      }
      
      // Step 2: Update the project's state and persist to DB.
      await updateProject(projectId, { isArchived: true });
  }, [selectedProjectId, selectProject, updateProject]);

  const unarchiveProject = useCallback(async (projectId: string) => {
      await updateProject(projectId, { isArchived: false });
  }, [updateProject]);

  const addProjectGroup = useCallback(async (groupData: Omit<ProjectGroup, 'id'>) => {
    const newGroup = { ...groupData, id: `group-${Date.now()}` };
    const originalGroups = projectGroups;
    setProjectGroups(prev => [...prev, newGroup]); // Optimistic update

    if (user) {
      try {
        await db.doc(`users/${user.id}/projectGroups/${newGroup.id}`).set(newGroup);
      } catch (error) {
        console.error("Failed to add project group, reverting:", error);
        setProjectGroups(originalGroups);
      }
    }
  }, [user, projectGroups]);

  const updateProjectGroup = useCallback(async (group: ProjectGroup) => {
    const originalGroups = projectGroups;
    setProjectGroups(prev => prev.map(g => g.id === group.id ? group : g)); // Optimistic update

    if (user) {
      try {
        await db.doc(`users/${user.id}/projectGroups/${group.id}`).update(group);
      } catch (error) {
        console.error("Failed to update project group, reverting:", error);
        setProjectGroups(originalGroups);
      }
    }
  }, [user, projectGroups]);

  const deleteProjectGroup = useCallback(async (groupId: string) => {
    const originalGroups = projectGroups;
    setProjectGroups(prev => prev.filter(g => g.id !== groupId)); // Optimistic update

    if (user) {
      try {
        await db.doc(`users/${user.id}/projectGroups/${groupId}`).delete();
      } catch (error) {
        console.error("Failed to delete project group, reverting:", error);
        setProjectGroups(originalGroups);
      }
    }
  }, [user, projectGroups]);

  const addTask = useCallback(async (projectId: string, task: Task) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const newTasks = [...project.tasks, task];
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
          // Perform updates in parallel
          await Promise.all([
              updateProject(sourceProjectId, { tasks: newSourceTasks }),
              updateProject(targetProjectId, { tasks: newTargetTasks })
          ]);
      }
  }, [projects, updateProject]);

  const reparentTask = useCallback(async (projectId: string, taskId: string, newParentId: string | null) => {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;

      const { foundTask, newTasks } = findAndRemoveTask(project.tasks, taskId);
      if (!foundTask) return;

      let finalTasks: Task[];
      if (newParentId === null) {
          finalTasks = [...newTasks, foundTask];
      } else {
          finalTasks = addSubtaskToTree(newTasks, newParentId, foundTask);
      }
      
      await updateProject(projectId, { tasks: finalTasks });
  }, [projects, updateProject]);
  
  const visibleProjects = useMemo(() => projects.filter(p => !p.isArchived), [projects]);
  const archivedProjects = useMemo(() => projects.filter(p => p.isArchived), [projects]);
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId) ?? null, [projects, selectedProjectId]);

  const contextValue = useMemo(() => ({
    projects,
    visibleProjects,
    archivedProjects,
    projectGroups,
    selectedProjectId,
    selectedProject,
    loading,
    selectProject,
    addProject,
    updateProject,
    deleteProject,
    archiveProject,
    unarchiveProject,
    addProjectGroup,
    updateProjectGroup,
    deleteProjectGroup,
    addTask,
    addSubtask,
    updateTask,
    updateMultipleTasks,
    deleteTask,
    moveTask,
    reparentTask,
  }), [
    projects, visibleProjects, archivedProjects, projectGroups, selectedProjectId, selectedProject, loading,
    selectProject, addProject, updateProject, deleteProject, archiveProject, unarchiveProject,
    addProjectGroup, updateProjectGroup, deleteProjectGroup, addTask, addSubtask, updateTask,
    updateMultipleTasks, deleteTask, moveTask, reparentTask
  ]);

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = (): ProjectContextType => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
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
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      setResources([]);
      return;
    }
    if (user) {
      setLoading(true);
      const resourcesRef = db.collection(`users/${user.id}/resources`);
      resourcesRef.limit(1).get().then(snapshot => {
        if (snapshot.empty) {
          console.log("New user resource collection is empty. Seeding initial data.");
          const batch = db.batch();
          INITIAL_RESOURCES.forEach(resource => {
            const resourceRef = db.doc(`users/${user.id}/resources/${resource.id}`);
            batch.set(resourceRef, resource);
          });
          batch.commit().catch(err => console.error("Failed to seed resources:", err));
        }
      });
      const resourcesQuery = db.collection(`users/${user.id}/resources`).orderBy('createdAt', 'desc');
      const unsubscribe = resourcesQuery.onSnapshot((snapshot) => {
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
    const newResource: Resource = { ...resourceData, id: `res-${Date.now()}`};
    const originalResources = resources;
    setResources(prev => [newResource, ...prev]);

    if (user) {
      try {
        await db.doc(`users/${user.id}/resources/${newResource.id}`).set(newResource);
      } catch (error) {
        console.error("Failed to add resource, reverting:", error);
        setResources(originalResources);
      }
    }
  }, [resources, user]);
  
  const updateResource = useCallback(async (resource: Resource) => {
    const originalResources = resources;
    setResources(prev => prev.map(r => r.id === resource.id ? resource : r));
    if (user) {
      try {
        await db.doc(`users/${user.id}/resources/${resource.id}`).update(resource);
      } catch (error) {
        console.error("Failed to update resource, reverting:", error);
        setResources(originalResources);
      }
    }
  }, [resources, user]);

  const deleteResource = useCallback(async (resourceId: string) => {
    const originalResources = resources;
    setResources(prev => prev.filter(r => r.id !== resourceId));
    if (user) {
      try {
        await db.doc(`users/${user.id}/resources/${resourceId}`).delete();
      } catch (error) {
        console.error("Failed to delete resource, reverting:", error);
        setResources(originalResources);
      }
    }
  }, [resources, user]);

  const contextValue = useMemo(() => ({
    resources, loading, addResource, updateResource, deleteResource
  }), [resources, loading, addResource, updateResource, deleteResource]);

  return <ResourceContext.Provider value={contextValue}>{children}</ResourceContext.Provider>;
};

export const useResource = (): ResourceContextType => {
  const context = useContext(ResourceContext);
  if (context === undefined) {
    throw new Error('useResource must be used within a ResourceProvider');
  }
  return context;
};