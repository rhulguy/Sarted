import { Task, Resource, Habit } from '../types';

const downloadFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// CSV Export
const escapeCsvCell = (cell: string | undefined | null): string => {
    if (cell === undefined || cell === null) return '';
    const str = String(cell);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

export const exportTasksToCsv = (tasks: Task[], projectName: string) => {
    let csvContent = 'Task Name,Description,Status,Start Date,End Date,Level\n';
    const traverse = (tasks: Task[], level: number) => {
        tasks.forEach(task => {
            csvContent += [
                escapeCsvCell(task.name),
                escapeCsvCell(task.description),
                task.completed ? 'Completed' : 'Incomplete',
                escapeCsvCell(task.startDate),
                escapeCsvCell(task.endDate),
                level
            ].join(',') + '\n';
            if (task.subtasks) traverse(task.subtasks, level + 1);
        });
    };
    traverse(tasks, 0);
    downloadFile(`${projectName}-tasks.csv`, csvContent, 'text/csv;charset=utf-8;');
};

export const exportResourcesToCsv = (resources: Resource[]) => {
    let csvContent = 'Title,URL,Notes\n';
    resources.forEach(res => {
        csvContent += [
            escapeCsvCell(res.title),
            escapeCsvCell(res.url),
            escapeCsvCell(res.notes)
        ].join(',') + '\n';
    });
    downloadFile('resources.csv', csvContent, 'text/csv;charset=utf-8;');
};

export const exportHabitsToCsv = (habits: Habit[], weekDates: Date[]) => {
    const header = ['Habit', ...weekDates.map(d => d.toLocaleDateString(undefined, {weekday: 'short', day: 'numeric', timeZone: 'UTC'}))].join(',');
    let body = '';
    habits.forEach(habit => {
        const row = [escapeCsvCell(habit.name)];
        weekDates.forEach(date => {
            const dateString = date.toISOString().slice(0, 10);
            row.push(habit.completions[dateString] ? '✅' : '');
        });
        body += row.join(',') + '\n';
    });
    const csvContent = `${header}\n${body}`;
    downloadFile('habits-this-week.csv', csvContent, 'text/csv;charset=utf-8;');
};


// DOC Export
const tasksToHtml = (tasks: Task[]): string => {
    let html = '<ul>';
    tasks.forEach(task => {
        html += `<li><strong>${task.name}</strong> (${task.completed ? 'Completed' : 'Incomplete'})</li>`;
        if (task.subtasks?.length) {
            html += tasksToHtml(task.subtasks);
        }
    });
    html += '</ul>';
    return html;
};

export const exportTasksToDoc = (tasks: Task[], projectName: string) => {
    const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>${projectName}</title></head>
        <body>
            <h1>${projectName}</h1>
            <h2>Tasks</h2>
            ${tasksToHtml(tasks)}
        </body>
        </html>
    `;
    downloadFile(`${projectName}-tasks.doc`, htmlContent, 'application/msword');
};

export const exportResourcesToDoc = (resources: Resource[]) => {
    let listItems = '';
    resources.forEach(res => {
        listItems += `<li><a href="${res.url}">${res.title}</a>: ${res.notes || 'No notes'}</li>`;
    });
    const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>Resources</title></head><body><h1>Resources</h1><ul>${listItems}</ul></body></html>`;
    downloadFile('resources.doc', htmlContent, 'application/msword');
};

export const exportHabitsToDoc = (habits: Habit[], weekDates: Date[]) => {
    const title = `Habits for week starting ${weekDates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
    let tableRows = '';
    const header = `<tr><th>Habit</th>${weekDates.map(d => `<th>${d.toLocaleDateString(undefined, {weekday: 'short', timeZone: 'UTC'})}</th>`).join('')}</tr>`;
    
    habits.forEach(habit => {
        let row = `<tr><td><strong>${escapeCsvCell(habit.name)}</strong></td>`;
        weekDates.forEach(date => {
            const dateString = date.toISOString().slice(0, 10);
            row += `<td style="text-align: center;">${habit.completions[dateString] ? '&#10003;' : ''}</td>`;
        });
        row += '</tr>';
        tableRows += row;
    });

    const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>${title}</title></head>
        <body>
            <h1>${title}</h1>
            <table border="1" cellpadding="5" style="border-collapse: collapse; text-align: center;">
                <thead>${header}</thead>
                <tbody>${tableRows}</tbody>
            </table>
        </body>
        </html>
    `;
    downloadFile('habits-this-week.doc', htmlContent, 'application/msword');
};
