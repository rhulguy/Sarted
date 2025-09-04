import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { Project, ProjectGroup, Task } from '../types';
import { useAuth } from './AuthContext';
import { db } from '../services/firebase';
import { 
    collection, onSnapshot, doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, query, addDoc
} from 'firebase/firestore';
import { INITIAL_PROJECT_GROUPS, INITIAL_PROJECTS } from '../constants';
import { updateTaskInTree, deleteTaskFromTree, addSubtaskToTree, updateTasksInTree, findAndRemoveTask } from '../utils/taskUtils';

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
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>(INITIAL_PROJECT_GROUPS);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHiddenProjects, setShowHiddenProjects] = useState(false);

  // Seed initial data for new users
  useEffect(() => {
    if (user) {
      const userDocRef = doc(db, 'users', user.id);
      getDoc(userDocRef).then(docSnap => {
        if (!docSnap.exists() || !docSnap.data()?.projectSeeded) {
          const batch = writeBatch(db);
          batch.set(userDocRef, { projectSeeded: true }, { merge: true });

          INITIAL_PROJECT_GROUPS.forEach(group => {
            const groupRef = doc(db, `users/${user.id}/projectGroups`, group.id);
            batch.set(groupRef, group);
          });
          INITIAL_PROJECTS.forEach(project => {
            const projectRef = doc(db, `users/${user.id}/projects`, project.id);
            batch.set(projectRef, { ...project, isHidden: false });
          });
          batch.commit();
        }
      });
    }
  }, [user]);
  
  // Listen for data changes from Firestore
  useEffect(() => {
    if (user) {
      setLoading(true);
      const projectsQuery = query(collection(db, `users/${user.id}/projects`));
      const groupsQuery = query(collection(db, `users/${user.id}/projectGroups`));

      const unsubProjects = onSnapshot(projectsQuery, (snapshot) => {
        const userProjects = snapshot.docs.map(d => {
            const data = d.data();
             // Defensively sanitize the data from Firestore to prevent crashes
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
                    subtasks: traverseAndFixTasks(t.subtasks) // Recursively fix subtasks
                }));
            }
            return {
                id: d.id,
                name: data.name || 'Untitled Project',
                groupId: data.groupId || '',
                tasks: traverseAndFixTasks(data.tasks),
                isHidden: data.isHidden ?? false,
            } as Project;
        });
        setProjects(userProjects);
      }, (error) => console.error("Error fetching projects:", error));
      
      const unsubGroups = onSnapshot(groupsQuery, (snapshot) => {
        const userGroups = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ProjectGroup));
        setProjectGroups(userGroups);
        setLoading(false);
      }, (error) => {
          console.error("Error fetching groups:", error);
          setLoading(false);
      });

      const settingsRef = doc(db, `users/${user.id}/settings`, 'main');
      const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
        if (docSnap.exists()) {
            setSelectedProjectId(docSnap.data().selectedProjectId || null);
        } else if (projects.length > 0) {
            setSelectedProjectId(projects[0].id)
        }
      }, (error) => console.error("Error fetching settings:", error));
      
      return () => { unsubProjects(); unsubGroups(); unsubSettings(); };
    } else {
      setProjects(INITIAL_PROJECTS);
      setProjectGroups(INITIAL_PROJECT_GROUPS);
      setSelectedProjectId(INITIAL_PROJECTS.length > 0 ? INITIAL_PROJECTS[0].id : null);
      setLoading(false);
    }
  }, [user]);

  const selectProject = useCallback(async (id: string | null) => {
    setSelectedProjectId(id);
    if (user) {
      try {
        const settingsRef = doc(db, `users/${user.id}/settings`, 'main');
        await setDoc(settingsRef, { selectedProjectId: id }, { merge: true });
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
            await setDoc(doc(db, `users/${user.id}/projects`, newProject.id), newProject);
        } catch (error) {
            console.error("Failed to add project, reverting:", error);
            setProjects(originalProjects); // Revert
        }
    }
  }, [projects, user, selectProject]);

  const deleteProject = useCallback(async (id: string) => {
    // Capture original state for a clean revert on failure
    const originalProjects = projects;
    const originalSelectedId = selectedProjectId;

    const remainingProjects = originalProjects.filter(p => p.id !== id);
    let nextSelectedId = selectedProjectId;

    // If the deleted project was the selected one, find a new one to select
    if (selectedProjectId === id) {
        nextSelectedId = remainingProjects.length > 0 ? remainingProjects[0].id : null;
    }

    // Perform optimistic state updates. React 18 batches these into a single render.
    setProjects(remainingProjects);
    if (selectedProjectId === id) {
        setSelectedProjectId(nextSelectedId);
    }

    if (user) {
        try {
            // Update the selected project setting in Firestore if it changed
            if (selectedProjectId === id) {
                const settingsRef = doc(db, `users/${user.id}/settings`, 'main');
                await setDoc(settingsRef, { selectedProjectId: nextSelectedId }, { merge: true });
            }
            // Delete the project document
            await deleteDoc(doc(db, `users/${user.id}/projects`, id));
        } catch (error) {
            console.error("Failed to delete project, reverting:", error);
            // Revert BOTH state updates for a consistent UI
            setProjects(originalProjects);
            setSelectedProjectId(originalSelectedId);
        }
    }
  }, [projects, user, selectedProjectId]);
  
  const toggleProjectVisibility = useCallback(async (id: string, isHidden: boolean) => {
      const originalProjects = projects;
      setProjects(prev => prev.map(p => p.id === id ? { ...p, isHidden } : p)); // Optimistic update
      
      if (isHidden && selectedProjectId === id) {
          await selectProject(null);
      }

      if (user) {
          try {
              await updateDoc(doc(db, `users/${user.id}/projects`, id), { isHidden });
          } catch (error) {
              console.error("Failed to update project visibility, reverting:", error);
              setProjects(originalProjects); // Revert
          }
      }
  }, [projects, user, selectedProjectId, selectProject]);

  // --- Project Group Management ---
  const addProjectGroup = useCallback(async (groupData: Omit<ProjectGroup, 'id'>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, `users/${user.id}/projectGroups`), groupData);
    } catch (error) {
      console.error("Failed to add project group:", error);
    }
  }, [user]);
  
  const updateProjectGroup = useCallback(async (group: ProjectGroup) => {
    if (!user) return;
    try {
      await setDoc(doc(db, `users/${user.id}/projectGroups`, group.id), group);
    } catch (error) {
      console.error("Failed to update project group:", error);
    }
  }, [user]);

  const deleteProjectGroup = useCallback(async (groupId: string) => {
    if (!user) return;
    // Note: This does not re-assign projects in the deleted group.
    // A more robust implementation might move them to a default group.
    try {
      await deleteDoc(doc(db, `users/${user.id}/projectGroups`, groupId));
    } catch (error) {
      console.error("Failed to delete project group:", error);
    }
  }, [user]);


  // Generic helper for updating tasks in a specific project
  const updateProjectTasks = useCallback(async (projectId: string, getNewTasks: (tasks: Task[]) => Task[]) => {
    const originalProjects = projects;
    const project = originalProjects.find(p => p.id === projectId);
    if (!project) return;
    
    const newTasks = getNewTasks(project.tasks);
    const newProjects = originalProjects.map(p => p.id === projectId ? { ...p, tasks: newTasks } : p);
    setProjects(newProjects); // Optimistic Update

    if (user) {
      try {
        const projectRef = doc(db, `users/${user.id}/projects`, projectId);
        await updateDoc(projectRef, { tasks: newTasks });
      } catch (error) {
        console.error("Failed to update tasks, reverting:", error);
        setProjects(originalProjects); // Revert on failure
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

    // Optimistic Update
    const newSourceTasks = deleteTaskFromTree(sourceProject.tasks, task.id);
    const newTargetTasks = [...targetProject.tasks, task];
    const newProjects = originalProjects.map(p => {
        if (p.id === sourceProjectId) return { ...p, tasks: newSourceTasks };
        if (p.id === targetProjectId) return { ...p, tasks: newTargetTasks };
        return p;
    });
    setProjects(newProjects);

    // Sync with Firebase
    try {
        const batch = writeBatch(db);
        const sourceRef = doc(db, `users/${user.id}/projects`, sourceProjectId);
        batch.update(sourceRef, { tasks: newSourceTasks });
        const targetRef = doc(db, `users/${user.id}/projects`, targetProjectId);
        batch.update(targetRef, { tasks: newTargetTasks });
        await batch.commit();
    } catch (error) {
        console.error("Failed to move task, reverting:", error);
        setProjects(originalProjects); // Revert
    }
  }, [projects, user]);

  const reparentTask = useCallback(async (projectId: string, taskId: string, newParentId: string | null) => {
      await updateProjectTasks(projectId, (currentTasks) => {
          const { foundTask, newTasks: treeWithoutTask } = findAndRemoveTask(currentTasks, taskId);
          if (!foundTask) return currentTasks; // Task not found, do nothing
          
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
    selectProject, addProject, deleteProject, toggleProjectVisibility, addProjectGroup, updateProjectGroup, deleteProjectGroup,
    addTask, addSubtask, updateTask, updateMultipleTasks, deleteTask, moveTask,
    reparentTask
  }), [projects, visibleProjects, projectGroups, selectedProjectId, selectedProject, loading, showHiddenProjects, selectProject, addProject, deleteProject, toggleProjectVisibility, addProjectGroup, updateProjectGroup, deleteProjectGroup, addTask, addSubtask, updateTask, updateMultipleTasks, deleteTask, moveTask, reparentTask]);

  return <ProjectContext.Provider value={contextValue}>{children}</ProjectContext.Provider>;
};

export const useProject = (): ProjectContextType => {
  const context = useContext(ProjectContext);
  if (context === undefined) throw new Error('useProject must be used within a ProjectProvider');
  return context;
};