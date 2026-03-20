import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Note {
  id: string;
  title: string;
  content: any;
  updated_at: string;
}

interface Block {
  id: string;
  type: 'text' | 'h1' | 'h2' | 'h3';
  content: string;
}


const BlockInput = ({ block, index, isFocused, isSelected, updateBlock, onKeyDown, onFocusNext, onFocusPrev, onManualFocus, onMouseEnter }: { 
    block: Block, 
    index: number,
    isFocused: boolean,
    isSelected: boolean,
    updateBlock: (id: string, content: string) => void,
    onKeyDown: (e: React.KeyboardEvent, index: number) => void,
    onFocusNext: (current: number, isShift: boolean) => void,
    onFocusPrev: (current: number, isShift: boolean) => void,
    onManualFocus: (isShift: boolean) => void,
    onMouseEnter: () => void
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isMouseDown, setIsMouseDown] = useState(false);

    useLayoutEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [block.content]);

    useEffect(() => {
        if (isFocused && textareaRef.current) {
            textareaRef.current.focus();
             // Always move cursor to end for consistency on focus entry
             // (Desired behavior can be refined later e.g. based on direction)
            // const len = textareaRef.current.value.length;
            // textareaRef.current.setSelectionRange(len, len);
        }
    }, [isFocused]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'ArrowDown') {
            const val = e.currentTarget.value;
            const start = e.currentTarget.selectionStart;
            // "At the end or in the last paragraph"
            // We check if there is no newline character after the cursor position.
            if (val.slice(start).indexOf('\n') === -1) {
                // We are in the last logical paragraph
                e.preventDefault();
                onFocusNext(index, e.shiftKey);
                return;
            }
        }
        if (e.key === 'ArrowUp') {
            const val = e.currentTarget.value;
            const start = e.currentTarget.selectionStart;
            // Check if there is no newline before the cursor
            if (val.slice(0, start).lastIndexOf('\n') === -1) {
                e.preventDefault();
                onFocusPrev(index, e.shiftKey);
                return;
            }
        }
        onKeyDown(e, index);
    };

    return (
        <textarea
            ref={textareaRef}
            className={`block-input type-${block.type} ${isSelected ? 'selected' : ''}`}
            value={block.content || ''}
            onChange={e => updateBlock(block.id, e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={(e) => {
                // If focus came from click, we might want to wait for click event to handle shift
                // But generally onFocus runs before onClick.
            }}
            onClick={(e) => {
                 onManualFocus(e.shiftKey);
            }}
            onMouseDown={(e) => {
                // Track mouse down to enable drag selection
                // If Shift is pressed, we want block selection, not text selection
                if (e.shiftKey) {
                    e.preventDefault();
                    onManualFocus(true);
                } else {
                    // Always start selection tracking on mouse down
                    onManualFocus(false);
                }
            }}
            onMouseEnter={(e) => {
                if (e.buttons === 1) { // If left mouse button is held down
                    onMouseEnter();
                }
            }}
            placeholder={block.type === 'text' ? "Type '/' for commands" : `Heading ${block.type.replace('h', '')}`}
            rows={1}
            style={{ 
                resize: 'none', 
                overflow: 'hidden',
                backgroundColor: isSelected ? 'rgba(170, 59, 255, 0.1)' : 'transparent'
            }}
        />
    );
};

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([{ id: crypto.randomUUID(), type: 'text', content: '' }]);
  const [title, setTitle] = useState('');
  const [focusedBlockIndex, setFocusedBlockIndex] = useState<number>(-1);
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null);
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  // const editorRef = useRef<HTMLElement>(null); // Not used currently
  
  // Track if we are in block selection mode by mouse
  const [isMouseSelecting, setIsMouseSelecting] = useState(false);

  // Global backspace prevention and selection deletion
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if (e.defaultPrevented) return; // Respect existing preventDefault calls

        const hasSelection = selectionAnchor !== null && selectionAnchor !== focusedBlockIndex;

        // Deselect on Escape, Enter, or Space if multiple blocks selected
        if (hasSelection && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) {
            setSelectionAnchor(null);
            if (e.key === 'Escape') e.preventDefault();
            // Allow Enter/Space to propagate to input for valid typing
        }

        if (e.key === 'Backspace') {
            const target = e.target as HTMLElement;
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
            
            // If we have a multi-block selection, we want to delete blocks, not backspace text in one block
            if (hasSelection) {
                 e.preventDefault();
                 const start = Math.min(selectionAnchor, focusedBlockIndex);
                 const end = Math.max(selectionAnchor, focusedBlockIndex);
                 
                 const newBlocks = blocks.filter((_, i) => i < start || i > end);
                 if (newBlocks.length === 0) {
                     newBlocks.push({ id: generateId(), type: 'text', content: '' });
                 }
                 setBlocks(newBlocks);
                 setSelectionAnchor(null);
                 setFocusedBlockIndex(start > 0 ? start - 1 : 0);
                 return;
            }

            // Prevent browser back navigation if not in an input
            if (!isInput) {
                e.preventDefault();
            }
        }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectionAnchor, focusedBlockIndex, blocks]);

  // Global mouse up for selection end
  useEffect(() => {
    const handleMouseUp = () => setIsMouseSelecting(false);
    
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Fetch notes
  useEffect(() => {
    if (!token) return;
    fetch('http://localhost:3000/api/notes', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
        if (res.status === 401) {
            logout();
            return [];
        }
        return res.json();
    })
    .then(data => {
        if (Array.isArray(data)) setNotes(data);
    })
    .catch(console.error);
  }, [token]);

  const generateId = () => {
    return crypto.randomUUID();
  };

  const createNote = async () => {
    if (!token) return;
    const initialBlocks = [{ id: generateId(), type: 'text', content: "" }];
    const newNote = { title: "Untitled", content: initialBlocks };
    
    try {
        const res = await fetch('http://localhost:3000/api/notes', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify(newNote)
        });
        
        if (res.ok) {
            const savedNote = await res.json();
            setNotes([savedNote, ...notes]);
            selectNote(savedNote);
        } else {
            console.error("Failed to create note:", await res.text());
        }
    } catch (e) {
        console.error("Error creating note:", e);
    }
  };

  const selectNote = (note: Note) => {
    setSelectedNote(note);
    setTitle(note.title);
    try {
        let content = note.content;
        if (typeof content === 'string') {
            try {
                content = JSON.parse(content);
            } catch {
                content = null;
            }
        }
        
        if (Array.isArray(content) && content.length > 0) {
            // Ensure every block has an ID and type
            const safeBlocks = content.map((b: any) => ({
                id: b.id || generateId(),
                type: b.type || 'text',
                content: b.content || ''
            }));
            setBlocks(safeBlocks);
        } else {
            setBlocks([{ id: generateId(), type: 'text', content: '' }]);
        }
    } catch (e) {
        console.error("Error parsing note content:", e);
        setBlocks([{ id: generateId(), type: 'text', content: '' }]);
    }
  };

  const saveNote = async () => {
    if (!selectedNote || !token) return;
    
    // Optimistic update
    const updated = { ...selectedNote, title, content: blocks };
    setNotes(notes.map(n => n.id === updated.id ? updated : n));

    await fetch(`http://localhost:3000/api/notes/${selectedNote.id}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ title, content: blocks })
    });
  };

  const updateBlock = (id: string, content: string) => {
    setBlocks(prev => prev.map(b => {
        if (b.id !== id) return b;
        
        if (b.type === 'text') {
            if (content === '# ') return { ...b, type: 'h1', content: '' };
            if (content === '## ') return { ...b, type: 'h2', content: '' };
            if (content === '### ') return { ...b, type: 'h3', content: '' };
        }
        
        return { ...b, content };
    }));
  };

  const addBlock = (index: number) => {
    const newBlock: Block = { id: generateId(), type: 'text', content: '' };
    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, newBlock);
    setBlocks(newBlocks);
    setFocusedBlockIndex(index + 1);
  };

  const removeBlock = (index: number) => {
    if (blocks.length <= 1) return;
    const newBlocks = [...blocks];
    newBlocks.splice(index, 1);
    setBlocks(newBlocks);
    setFocusedBlockIndex(index - 1 >= 0 ? index - 1 : 0);
  };


  const handleFocus = (index: number, isShift: boolean = false) => {
      if (index < 0 || index >= blocks.length) return;
      
      if (isShift) {
        if (selectionAnchor === null) {
            setSelectionAnchor(focusedBlockIndex !== -1 ? focusedBlockIndex : index);
        }
      } else {
         // If we are merely clicking, reset anchor unless we are dragging?
         // This is handled by onMouseDown logic separately if needed
         if (!isMouseSelecting) {
            setSelectionAnchor(null);
         }
      }
      setFocusedBlockIndex(index);
  };
  
  const handleMouseEnter = (index: number) => {
      if (isMouseSelecting) {
         // If we are selecting, update focus, which updates selection range
         setFocusedBlockIndex(index);
      }
  };

  const isBlockSelected = (index: number) => {
      if (selectionAnchor === null) return false;
      const start = Math.min(selectionAnchor, focusedBlockIndex);
      const end = Math.max(selectionAnchor, focusedBlockIndex);
      return index >= start && index <= end;
  };
  
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addBlock(index);
    } // If Backspace is pressed and selection exists
    else if (e.key === 'Backspace') {
       if (selectionAnchor !== null && selectionAnchor !== focusedBlockIndex) {
          e.preventDefault();
          const start = Math.min(selectionAnchor, focusedBlockIndex);
          const end = Math.max(selectionAnchor, focusedBlockIndex);
          
          // Remove range
          const newBlocks = blocks.filter((_, i) => i < start || i > end);
          if (newBlocks.length === 0) {
             newBlocks.push({ id: generateId(), type: 'text', content: '' });
          }
          setBlocks(newBlocks);
          setSelectionAnchor(null);
          setFocusedBlockIndex(start > 0 ? start - 1 : 0);
       } else if (blocks[index].content === '') {
           if (blocks[index].type !== 'text') {
              e.preventDefault();
              setBlocks(prev => prev.map((b, i) => i === index ? { ...b, type: 'text' } : b));
           } else {
              e.preventDefault();
              removeBlock(index);
           }
       }
    }
  };

  return (
    <div className="notes-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
            <button className="back-btn" onClick={() => navigate('/')}>←</button>
            <h3>Notes</h3>
            <button className="add-btn" onClick={createNote}>+</button>
        </div>
        <ul className="notes-list">
          {notes.map(note => (
            <li key={note.id} 
                className={selectedNote?.id === note.id ? 'active' : ''}
                onClick={() => selectNote(note)}>
              {note.title || "Untitled"}
            </li>
          ))}
        </ul>
      </aside>
      <main className="editor">
        {selectedNote ? (
          <>
            <input 
              className="title-input"
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              onBlur={saveNote}
              placeholder="Untitled"
            />
            <div className="blocks-container">
              {blocks.map((block, index) => (
                <div key={block.id} className="block-wrapper">
                  <BlockInput 
                      block={block}
                      index={index}
                      updateBlock={updateBlock}
                      onKeyDown={handleKeyDown}
                      isFocused={focusedBlockIndex === index}
                      isSelected={isBlockSelected(index)}
                      onFocusNext={(next, isShift) => handleFocus(next + 1, isShift)}
                      onFocusPrev={(prev, isShift) => handleFocus(prev - 1, isShift)}
                      onManualFocus={(isShift) => {
                          if (isShift) {
                              handleFocus(index, true); 
                          } else {
                              setSelectionAnchor(index);
                              setFocusedBlockIndex(index);
                              setIsMouseSelecting(true);
                          }
                      }}
                      onMouseEnter={() => handleMouseEnter(index)}
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">Select a note or create a new one.</div>
        )}
      </main>
    </div>
  );
}
