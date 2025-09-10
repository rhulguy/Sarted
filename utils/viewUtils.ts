import { MainView } from '../App';
import { MindMapIcon, GanttIcon, CalendarIcon, BookmarkSquareIcon, ImageIcon, ListIcon, FolderIcon, TrendingUpIcon } from '../components/IconComponents';

export const getIconForView = (view: MainView): React.ElementType | null => {
    switch(view) {
        case 'global-mindmap': return MindMapIcon;
        case 'global-gantt': return GanttIcon;
        case 'calendar': return CalendarIcon;
        case 'resources': return BookmarkSquareIcon;
        case 'dreamboard': return ImageIcon;
        case 'list-inbox': return ListIcon;
        case 'projects': return FolderIcon;
        case 'habits': return TrendingUpIcon;
        default: return FolderIcon;
    }
};