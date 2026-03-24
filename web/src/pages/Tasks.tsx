import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  is_starred: boolean;
  due_date?: string;
  list_id?: string;
  parent_id?: string;
  created_at?: string;
}

interface TaskList {
  id: string;
  title: string;
  color?: string;
  icon?: string;
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lists, setLists] = useState<TaskList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null); // null = All Tasks
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newListTitle, setNewListTitle] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { token, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // --- Initial Load ---
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchLists();
    fetchTasks();
  }, [isAuthenticated, selectedListId, showStarredOnly]);

  // --- Fetchers ---
  const fetchLists = async () => {
    try {
      const res = await fetch(`${API_URL}/api/lists`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setLists(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/tasks?`;
      if (selectedListId) url += `list_id=${selectedListId}&`;
      if (showStarredOnly) url += `is_starred=true&`;
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setTasks(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubtasks = async (taskId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/tasks?parent_id=${taskId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setSubtasks(await res.json());
    } catch (e) { console.error(e); }
  };

  // --- Actions ---

  const handleCreateTask = async (e: React.FormEvent, parentId?: string) => {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title && !parentId) return;
    // If parentId is present, we might use a different input ref, but let's assume we use state or passed value
    // For simplicity in this monolithic replacement, we'll use newTaskTitle for main tasks
    // and handle subtasks separately in the UI render to avoid complexity.
    
    // Wait, the subtask form below uses a separate input but calls this handler? 
    // Actually, let's fix the subtask creation to be robust.
    
    // If called from main form:
    if(!parentId && !title) return;
    
    // If called from subtask form (we'll handle extraction there or pass title)
    // Let's refactor:
  };
  
  const createNewTask = async (title: string, parentId?: string) => {
      try {
      const body: any = { 
        title, 
        list_id: selectedListId, 
        parent_id: parentId 
      };
      
      const res = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error('Failed');
      
      const newTask = await res.json();
      
      if (parentId) {
        setSubtasks([...subtasks, newTask]);
      } else {
        setTasks([newTask, ...tasks]);
      }
    } catch (err: any) {
      setError(err.message);
    }
  }

  const updateTask = async (id: string, updates: Partial<Task>) => {
    // Optimistic UI
    setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t));
    if (selectedTask?.id === id) setSelectedTask({ ...selectedTask, ...updates });
    // Also update subtasks if present
    setSubtasks(subtasks.map(t => t.id === id ? { ...t, ...updates } : t));

    try {
      await fetch(`${API_URL}/api/tasks/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
    } catch (e) {
      fetchTasks(); // Revert on error
    }
  };

  const handleDeleteTask = async (id: string, isSubtask = false) => {
    if (!confirm('Delete this task?')) return;
    try {
      await fetch(`${API_URL}/api/tasks/${id}`, {
         method: 'DELETE',
         headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (isSubtask) {
          setSubtasks(subtasks.filter(t => t.id !== id));
      } else {
          setTasks(tasks.filter(t => t.id !== id));
          if (selectedTask?.id === id) setSelectedTask(null);
      }
    } catch (e) { setError('Failed to delete'); }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    try {
        const res = await fetch(`${API_URL}/api/lists`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ title: newListTitle })
        });
        
        if (res.ok) {
            const newList = await res.json();
            setLists([...lists, newList]);
            setNewListTitle('');
        } else {
            console.error('Failed to create list', res.status, await res.text());
            alert('Failed to create list. Please try again.');
        }
    } catch (e) { 
        console.error(e);
        alert('Error creating list.');
    }
  };

  // --- UI Components ---

  const TaskItem = ({ task, isSubtask = false }: { task: Task, isSubtask?: boolean }) => (
    <div 
        onClick={() => {
            setSelectedTask(task);
            fetchSubtasks(task.id);
        }}
        style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: '12px', 
            marginBottom: '0', 
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            cursor: 'pointer',
            backgroundColor: selectedTask?.id === task.id ? '#e0f2fe' : (task.status === 'done' ? '#f8fafc' : 'white'),
            opacity: task.status === 'done' ? 0.7 : 1,
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            transition: 'all 0.2s'
        }}
    >
      <input
        type="checkbox"
        checked={task.status === 'done' || task.status === 'completed'}
        onClick={(e) => e.stopPropagation()}
        onChange={() => updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' })}
        style={{ marginRight: '12px', width: '18px', height: '18px', cursor: 'pointer', accentColor: '#3b82f6' }}
      />
      
      <span style={{ 
          flex: 1, 
          textDecoration: task.status === 'done' ? 'line-through' : 'none',
          color: task.status === 'done' ? '#94a3b8' : '#334155',
          fontWeight: 500
      }}>
        {task.title}
        {task.due_date && (
            <div style={{ fontSize: '0.75rem', color: new Date(task.due_date) < new Date() && task.status !== 'done' ? '#ef4444' : '#64748b', marginTop: '2px' }}>
                📅 {new Date(task.due_date).toLocaleDateString()}
            </div>
        )}
      </span>

      <button 
        onClick={(e) => {
            e.stopPropagation();
            updateTask(task.id, { is_starred: !task.is_starred });
        }}
        style={{ 
            background: 'none', border: 'none', cursor: 'pointer', 
            color: task.is_starred ? '#f59e0b' : '#d1d5db', fontSize: '1.2rem', marginRight: '10px'
        }}
      >
        ★
      </button>

      <button 
        onClick={(e) => {
            e.stopPropagation();
            handleDeleteTask(task.id, isSubtask);
        }}
        style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        ×
      </button>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f8fafc' }}>
      
      {/* Sidebar - Lists */}
      <div style={{ width: '250px', backgroundColor: '#1e293b', color: 'white', padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '20px', color: '#f1f5f9' }}>Task Lists</h2>
        
        <div 
            onClick={() => { setSelectedListId(null); setShowStarredOnly(false); }}
            style={{ 
                padding: '10px', 
                cursor: 'pointer', 
                backgroundColor: !selectedListId && !showStarredOnly ? '#334155' : 'transparent', 
                borderRadius: '6px',
                marginBottom: '5px',
                color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px'
            }}
        >
            📑 All Tasks
        </div>
        
        <div 
            onClick={() => { setShowStarredOnly(true); setSelectedListId(null); }}
            style={{ 
                padding: '10px', 
                cursor: 'pointer', 
                backgroundColor: showStarredOnly ? '#334155' : 'transparent', 
                borderRadius: '6px',
                marginBottom: '15px',
                color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px'
            }}
        >
            ⭐ Starred
        </div>

        <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 'bold' }}>Your Lists</div>
        
        <div style={{ flex: 1, overflowY: 'auto' }}>
            {lists.map(list => (
                <div 
                    key={list.id}
                    onClick={() => { setSelectedListId(list.id); setShowStarredOnly(false); }}
                    style={{ 
                        padding: '10px', 
                        cursor: 'pointer', 
                        backgroundColor: selectedListId === list.id ? '#334155' : 'transparent', 
                        borderRadius: '6px',
                        marginBottom: '4px',
                        display: 'flex', alignItems: 'center', gap: '8px',
                        color: selectedListId === list.id ? 'white' : '#cbd5e1'
                    }}
                >
                    <span>{list.icon || '📂'}</span> {list.title}
                </div>
            ))}
        </div>

        <form onSubmit={handleCreateList} style={{ marginTop: '15px', display: 'flex', gap: '5px' }}>
            <input 
                value={newListTitle}
                onChange={e => setNewListTitle(e.target.value)}
                placeholder="+ New List"
                style={{ 
                    flex: 1, 
                    padding: '8px', 
                    borderRadius: '4px', 
                    border: '1px solid #475569', 
                    backgroundColor: '#1e293b', 
                    color: 'white',
                    outline: 'none'
                }}
            />
            <button 
                type="submit"
                disabled={!newListTitle.trim()}
                style={{
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0 10px',
                    cursor: newListTitle.trim() ? 'pointer' : 'default',
                    opacity: newListTitle.trim() ? 1 : 0.5
                }}
            >
                +
            </button>
        </form>

        <button onClick={() => navigate('/')} style={{ marginTop: '20px', padding: '10px', backgroundColor: '#334155', color: '#cbd5e1', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Back to Dashboard
        </button>
      </div>

      {/* Main Content - Tasks */}
      <div style={{ flex: 1, padding: '30px', overflowY: 'auto', borderRight: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
        <h1 style={{ marginBottom: '20px', color: '#0f172a' }}>
            {showStarredOnly ? 'Starred Tasks' : (selectedListId ? lists.find(l => l.id === selectedListId)?.title : 'All Tasks')}
        </h1>
        
        <form onSubmit={(e) => { e.preventDefault(); if(newTaskTitle.trim()) { createNewTask(newTaskTitle.trim()); setNewTaskTitle(''); } }} style={{ marginBottom: '20px' }}>
            <input 
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                placeholder="Add a new task..."
                style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            />
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tasks.filter(t => t.status !== 'done').map(task => <TaskItem key={task.id} task={task} />)}
            
            {tasks.some(t => t.status === 'done') && (
                <div style={{ marginTop: '30px' }}>
                    <h3 style={{ fontSize: '1rem', color: '#64748b', marginBottom: '10px' }}>Completed</h3>
                    {tasks.filter(t => t.status === 'done').map(task => <TaskItem key={task.id} task={task} />)}
                </div>
            )}

            {tasks.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>No tasks found in this view.</div>}
        </div>
      </div>

      {/* Right Panel - Details */}
      {selectedTask && (
        <div style={{ width: '350px', backgroundColor: 'white', padding: '20px', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>Task Details</h3>
                <button onClick={() => setSelectedTask(null)} style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
            </div>

            <input 
                value={selectedTask.title}
                onChange={(e) => updateTask(selectedTask.id, { title: e.target.value })}
                style={{ fontSize: '1.1rem', fontWeight: 'bold', border: 'none', borderBottom: '1px solid #e2e8f0', padding: '5px 0', marginBottom: '15px', width: '100%', outline: 'none' }}
            />

            <label style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '5px', display: 'block' }}>Due Date</label>
            <input 
                type="date"
                value={selectedTask.due_date ? selectedTask.due_date.split('T')[0] : ''}
                onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value).toISOString() : undefined;
                    updateTask(selectedTask.id, { due_date: date });
                }}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', marginBottom: '20px', color: '#334155' }}
            />

            <label style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '5px' }}>Description / Notes</label>
            <textarea 
                value={selectedTask.description || ''}
                onChange={(e) => updateTask(selectedTask.id, { description: e.target.value })}
                placeholder="Add notes..."
                style={{ width: '100%', minHeight: '100px', padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1', marginBottom: '20px', resize: 'vertical' }}
            />

            <label style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '5px' }}>Subtasks</label>
            <div style={{ marginBottom: '20px' }}>
                {subtasks.map(st => <TaskItem key={st.id} task={st} isSubtask={true} />)}
                
                <form 
                    onSubmit={(e) => {
                        e.preventDefault();
                        const input = (e.currentTarget.elements[0] as HTMLInputElement);
                        const val = input.value.trim();
                        if(val) {
                             createNewTask(val, selectedTask.id).then(() => { input.value = ''; });
                        }
                    }} 
                    style={{ marginTop: '10px', display: 'flex' }}
                >
                    <input placeholder="Add subtask..." style={{ flex: 1, padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                    <button type="submit" style={{ marginLeft: '5px', padding: '5px 10px', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+</button>
                </form>
            </div>

            <div style={{ flex: 1 }}></div>
            
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>
                Created: {new Date(selectedTask.created_at || '').toLocaleDateString()}
            </div>
        </div>
      )}

    </div>
  );
}
