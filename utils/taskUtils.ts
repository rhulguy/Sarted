import { Task } from '../types';

/**
 * Recursively finds and updates a task within a tree of tasks.
 * @returns A new array with the updated task.
 */
export const updateTaskInTree = (tasks: Task[], updatedTask: Task): Task[] => {
  return tasks.map(task => {
    if (task.id === updatedTask.id) {
      return updatedTask;
    }
    if (task.subtasks?.length) {
      return { ...task, subtasks: updateTaskInTree(task.subtasks, updatedTask) };
    }
    return task;
  });
};

/**
 * Recursively finds and updates multiple tasks within a tree of tasks.
 * @returns A new array with the updated tasks.
 */
export const updateTasksInTree = (tasks: Task[], tasksToUpdate: Task[]): Task[] => {
    const updatesMap = new Map(tasksToUpdate.map(t => [t.id, t]));
    
    const recursiveUpdate = (currentTasks: Task[]): Task[] => {
        return currentTasks.map(task => {
            const updatedTask = updatesMap.get(task.id);
            const subtasks = task.subtasks ? recursiveUpdate(task.subtasks) : [];

            if (updatedTask) {
                // Return a new object with merged properties and updated subtasks
                return { ...task, ...updatedTask, subtasks };
            }
            // Return a new object with potentially updated subtasks
            return { ...task, subtasks };
        });
    };

    return recursiveUpdate(tasks);
};


/**
 * Recursively finds and deletes a task from a tree of tasks.
 * @returns A new array with the task removed.
 */
export const deleteTaskFromTree = (tasks: Task[], taskId: string): Task[] => {
  return tasks.reduce((acc, task) => {
    if (task.id === taskId) {
      return acc; // Skip this task
    }
    if (task.subtasks?.length) {
      acc.push({ ...task, subtasks: deleteTaskFromTree(task.subtasks, taskId) });
    } else {
      acc.push(task);
    }
    return acc;
  }, [] as Task[]);
};

/**
 * Recursively finds a parent task and adds a new subtask to it.
 * @returns A new array with the new subtask added.
 */
export const addSubtaskToTree = (tasks: Task[], parentId: string, newSubtask: Task): Task[] => {
  return tasks.map(task => {
    if (task.id === parentId) {
      return { ...task, subtasks: [...(task.subtasks || []), newSubtask] };
    }
    if (task.subtasks?.length) {
      return { ...task, subtasks: addSubtaskToTree(task.subtasks, parentId, newSubtask) };
    }
    return task;
  });
};

/**
 * Recursively calculates the number of completed and total tasks.
 * @returns An object with completed and total counts.
 */
export const calculateProgress = (tasks: Task[]): { completed: number, total: number } => {
    let completed = 0;
    let total = 0;
    
    tasks.forEach(task => {
        total++;
        if (task.completed) {
            completed++;
        }
        if (task.subtasks?.length) {
            const subtaskProgress = calculateProgress(task.subtasks);
            completed += subtaskProgress.completed;
            total += subtaskProgress.total;
        }
    });

    return { completed, total };
}

/**
 * Recursively finds and removes a task from a tree.
 * @returns An object containing the found task and the new tree without the task.
 */
export const findAndRemoveTask = (tasks: Task[], taskId: string): { foundTask: Task | null, newTasks: Task[] } => {
    let foundTask: Task | null = null;

    const filterAndFind = (currentTasks: Task[]): Task[] => {
        const remainingTasks: Task[] = [];
        for (const task of currentTasks) {
            if (task.id === taskId) {
                foundTask = task;
                continue; // Skip adding it to the new array
            }
            if (task.subtasks && !foundTask) {
                const newSubtasks = filterAndFind(task.subtasks);
                remainingTasks.push({ ...task, subtasks: newSubtasks });
            } else {
                remainingTasks.push(task);
            }
        }
        return remainingTasks;
    };

    const newTasks = filterAndFind(tasks);
    return { foundTask, newTasks };
};

// --- Gantt Chart Snapping Helpers ---

export const int = (v: number): number => Math.round(v);

export function dateToIndexUTC(chartStartDate: Date, date: Date): number {
  const a = Date.UTC(chartStartDate.getUTCFullYear(), chartStartDate.getUTCMonth(), chartStartDate.getUTCDate());
  const b = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((b - a) / 86400000); // 1000 * 60 * 60 * 24
}

export function indexToDateUTC(chartStartDate: Date, idx: number): Date {
  const d = new Date(chartStartDate);
  d.setUTCDate(d.getUTCDate() + idx);
  d.setUTCHours(0,0,0,0);
  return d;
}

export function pixelToIndex(px: number, dayWidth: number): number {
    return Math.max(0, Math.floor(px / dayWidth));
}

export function inclusiveWidth(startIdx: number, endIdx: number, dayWidth: number): number {
  return Math.max(dayWidth, (endIdx - startIdx + 1) * dayWidth);
}