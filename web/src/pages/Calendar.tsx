import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  original_tz: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  transparency: 'opaque' | 'transparent';
  visibility: 'public' | 'private' | 'confidential';
  color: string;
}

type ViewMode = 'day' | 'week' | 'month';

export default function Calendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
    const { token, logout } = useAuth();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventColor, setNewEventColor] = useState("var(--accent)");
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Default new event times
  const getDefaultEventTimes = () => {
    const start = new Date(currentDate);
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);
    return { start, end };
  };

  const toLocalISOString = (date: Date) => {
    const pad = (n: number) => n < 10 ? '0' + n : n;
    return date.getFullYear() +
        '-' + pad(date.getMonth() + 1) +
        '-' + pad(date.getDate()) +
        'T' + pad(date.getHours()) +
        ':' + pad(date.getMinutes());
  };

  const [newEventStart, setNewEventStart] = useState("");
  const [newEventEnd, setNewEventEnd] = useState("");

  // Helper to init modal with specific times
  const openModalWithTimes = (start: Date, end: Date) => {
      setNewEventStart(toLocalISOString(start));
      setNewEventEnd(toLocalISOString(end));
      setNewEventTitle("");
      setNewEventColor("var(--accent)");
      setModalMode('create');
      setIsModalOpen(true);
  };

  const openModalEdit = (event: CalendarEvent) => {
      setNewEventTitle(event.title);
      setNewEventStart(toLocalISOString(new Date(event.start_time)));
      setNewEventEnd(toLocalISOString(new Date(event.end_time)));
      setNewEventColor(event.color || "var(--accent)");
      setSelectedEventId(event.id);
      setModalMode('edit');
      setIsModalOpen(true);
  };

  const handleCreateEventClick = () => {
    const { start, end } = getDefaultEventTimes();
    openModalWithTimes(start, end);
  };


  // --- Date Helpers ---
  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday, behave like Monday is first day
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const getEndOfWeek = (date: Date) => {
    const d = getStartOfWeek(date);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  };

  const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      const days: { date: Date; isCurrentMonth: boolean }[] = [];
      // Fill previous month days to start on Monday (or Sunday)
      let startDay = firstDay.getDay(); // 0-6
      const offset = startDay === 0 ? 6 : startDay - 1; // 0=Mon, 6=Sun
      
      for (let i = offset; i > 0; i--) {
          const d = new Date(year, month, 1 - i);
          days.push({ date: d, isCurrentMonth: false });
      }

      for (let i = 1; i <= lastDay.getDate(); i++) {
          const d = new Date(year, month, i);
          days.push({ date: d, isCurrentMonth: true });
      }

      // Fill remaining days to complete the grid
      while (days.length % 7 !== 0) {
          const last = days[days.length - 1].date;
          const d = new Date(last);
          d.setDate(d.getDate() + 1);
          days.push({ date: d, isCurrentMonth: false });
      }

      return days;
  };

  // --- Fetch Events ---
  useEffect(() => {
    if (!token) return;

    let start = new Date(currentDate);
    let end = new Date(currentDate);

    if (viewMode === 'day') {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
    } else if (viewMode === 'week') {
        start = getStartOfWeek(currentDate);
        end = getEndOfWeek(currentDate);
    } else {
        // Month view: Fetch a bit more to cover full grid
        const days = getDaysInMonth(currentDate);
        start = days[0].date;
        end = days[days.length - 1].date;
        end.setHours(23, 59, 59, 999);
    }

    const query = new URLSearchParams({
        start_date: start.toISOString(),
        end_date: end.toISOString()
    });

    fetch(`${API_URL}/api/calendar/events?${query}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
        .then(async res => {
            if (res.status === 401) {
                logout();
                navigate('/login');
                return [];
            }
            return res.json();
        })
    .then(data => setEvents(data))
    .catch(err => console.error(err));
    }, [token, currentDate, viewMode, logout, navigate]);


  // --- Event Creation / Update ---
  const handleSaveEvent = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!token) return;

      const payload = {
          title: newEventTitle,
          start_time: new Date(newEventStart).toISOString(),
          end_time: new Date(newEventEnd).toISOString(),
          color: newEventColor,
          original_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          status: 'confirmed',
          transparency: 'opaque',
          visibility: 'private'
      };

      try {
          let url = `${API_URL}/api/calendar/events`;
          let method = 'POST';

          if (modalMode === 'edit' && selectedEventId) {
              url = `${API_URL}/api/calendar/events/${selectedEventId}`;
              method = 'PATCH';
          }

          const res = await fetch(url, {
              method: method,
              headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
              },
              body: JSON.stringify(payload)
          });

          if (res.status === 401) {
              logout();
              navigate('/login');
              return;
          }

          if (res.ok) {
              const savedEvent = await res.json();
              if (modalMode === 'create') {
                  setEvents([...events, savedEvent]);
              } else {
                  setEvents(events.map(ev => ev.id === savedEvent.id ? savedEvent : ev));
              }
              setIsModalOpen(false);
              setNewEventTitle("");
              setSelectedEventId(null);
          } else {
              const errorText = await res.text();
              alert(`Failed to save event: ${errorText}`);
          }
      } catch (err) {
          console.error(err);
      }
  };


  // --- Navigation Handlers ---
  const handlePrev = () => {
      const newDate = new Date(currentDate);
      if (viewMode === 'day') newDate.setDate(newDate.getDate() - 1);
      if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
      if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
      setCurrentDate(newDate);
  };

  const handleNext = () => {
      const newDate = new Date(currentDate);
      if (viewMode === 'day') newDate.setDate(newDate.getDate() + 1);
      if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
      if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
      setCurrentDate(newDate);
  };

  const isSameDate = (d1: Date, d2: Date) => {
      return d1.getFullYear() === d2.getFullYear() &&
             d1.getMonth() === d2.getMonth() &&
             d1.getDate() === d2.getDate();
  };

  // Render Logic
  const renderWeekView = () => {
      const startOfWeek = getStartOfWeek(currentDate);
      // Generate days for the view (7 for week, 1 for day)
      const daysToShow = viewMode === 'day' ? 1 : 7;
      const viewDays = Array.from({ length: daysToShow }).map((_, i) => {
          const d = new Date(viewMode === 'day' ? currentDate : startOfWeek);
          if (viewMode === 'week') d.setDate(d.getDate() + i);
          return d;
      });

      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}>
            {/* Header / Week Days */}
            <div style={{ display: 'flex', paddingLeft: '60px', borderBottom: '1px solid var(--card-bg)' }}>
                {viewDays.map((day, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderLeft: '1px solid var(--card-bg)', fontWeight: isSameDate(day, new Date()) ? 'bold' : 'normal', color: isSameDate(day, new Date()) ? 'var(--accent)' : 'var(--text-secondary)' }}>
                        <div>{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                        <div style={{ fontSize: '1.2rem' }}>{day.getDate()}</div>
                    </div>
                ))}
            </div>

            {/* Scrollable Time Grid */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', position: 'relative' }}>
                {/* Time Gutter */}
                <div style={{ width: '60px', flexShrink: 0 }}>
                    {Array.from({ length: 24 }).map((_, i) => (
                        <div key={i} style={{ height: '60px', borderBottom: '1px solid var(--card-bg)', textAlign: 'right', paddingRight: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {i}:00
                        </div>
                    ))}
                </div>

                {/* Columns & Events */}
                <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
                    {/* Background Grid Lines (Horizontal) */}
                    {Array.from({ length: 24 }).map((_, i) => (
                        <div key={i} style={{ position: 'absolute', top: `${i * 60}px`, left: 0, right: 0, height: '60px', borderBottom: '1px solid var(--card-bg)', pointerEvents: 'none' }}></div>
                    ))}
                    
                    {/* Column Borders (Vertical) */}
                    {viewDays.map((_, i) => (
                        <div key={i} style={{ flex: 1, borderLeft: '1px solid var(--card-bg)', height: '1440px', pointerEvents: 'none' }}></div>
                    ))}

                    {/* Interaction Layer */}
                    <div 
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5, cursor: 'crosshair' }}
                        // Calculate Time logic needs to use offsetY from event if relative, but getBoundingClientRect is safer due to scrolling
                        onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const y = e.clientY - rect.top; // Relative to viewport top vs element top works even with scroll

                            const colWidth = rect.width / daysToShow;
                            const colIndex = Math.floor(x / colWidth);
                            
                            if (colIndex < 0 || colIndex >= viewDays.length) return;

                            const clickedDate = new Date(viewDays[colIndex]);
                            
                            // 60px per hour
                            // rect.height should be 1440
                            let hourRaw = y / 60;
                            // Clamp
                            if (hourRaw < 0) hourRaw = 0;
                            if (hourRaw > 23.9) hourRaw = 23.9;

                            const hour = Math.floor(hourRaw);
                            const minuteRaw = (hourRaw - hour) * 60;
                            
                            // Snap to 30 mins for easier clicking
                            const minute = Math.round(minuteRaw / 30) * 30;

                            clickedDate.setHours(hour, minute, 0, 0);
                            const endDate = new Date(clickedDate);
                            endDate.setHours(clickedDate.getHours() + 1);
                            
                            openModalWithTimes(clickedDate, endDate);
                        }}
                    ></div>

                    {/* Events */}
                    {events.map(event => {
                         const start = new Date(event.start_time);
                         const end = new Date(event.end_time);
                         
                         // Determine column index
                         let colIndex = -1;
                         if (viewMode === 'day') {
                             if (isSameDate(start, currentDate)) colIndex = 0;
                         } else {
                            // Week view logic
                            const diffTime = start.getTime() - startOfWeek.getTime();
                            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                            if (diffDays >= 0 && diffDays < 7) colIndex = diffDays;
                         }

                         if (colIndex === -1) return null;

                         const startHours = start.getHours() + start.getMinutes() / 60;
                         const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                        
                         // Calculate width and left position
                         const widthPercent = 100 / daysToShow;
                         const leftPercent = colIndex * widthPercent;

                         return (
                             <div 
                                key={event.id}
                                title={event.title}
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    openModalEdit(event);
                                }}
                                style={{
                                    position: 'absolute',
                                    top: `${startHours * 60}px`, // 60px per hour
                                    height: `${Math.max(durationHours * 60, 25)}px`,
                                    left: `${leftPercent}%`,
                                    width: `${widthPercent}%`,
                                    padding: '2px',
                                    zIndex: 10
                                }}
                             >
                                 <div style={{
                                     backgroundColor: event.color || 'var(--accent)',
                                     borderLeft: '3px solid rgba(0,0,0,0.2)',
                                     height: '100%',
                                     borderRadius: '4px',
                                     padding: '4px',
                                     fontSize: '0.75rem',
                                     overflow: 'hidden',
                                     cursor: 'pointer',
                                     color: 'white'
                                 }}>
                                    <strong>{event.title}</strong>
                                    <div>{start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                 </div>
                             </div>
                         );
                    })}
                    
                    {/* Current Time Indicator logic could be added here */}
                </div>
            </div>
        </div>
      );
  };

  const renderMonthView = () => {
    const days = getDaysInMonth(currentDate);
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card-bg)' }}>
                {weekDays.map(d => (
                    <div key={d} style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{d}</div>
                ))}
            </div>
            
            {/* Grid */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(100px, 1fr)', overflowY: 'auto' }}>
                {days.map((dayObj, i) => {
                    const dayEvents = events.filter(e => isSameDate(new Date(e.start_time), dayObj.date));
                    
                    return (
                        <div key={i} 
                            onClick={() => {
                                const start = new Date(dayObj.date);
                                start.setHours(9, 0, 0, 0); // Default 9 AM
                                const end = new Date(start);
                                end.setHours(10, 0, 0, 0);
                                openModalWithTimes(start, end);
                            }}
                            style={{ 
                            borderRight: '1px solid var(--border)', 
                            borderBottom: '1px solid var(--border)', 
                            padding: '5px',
                            backgroundColor: dayObj.isCurrentMonth ? 'transparent' : 'var(--accent-weak)',
                            overflow: 'hidden',
                            minHeight: '100px'
                        }}>
                            <div style={{ 
                                marginBottom: '5px', 
                                color: isSameDate(dayObj.date, new Date()) ? 'var(--accent)' : 'inherit', 
                                fontWeight: isSameDate(dayObj.date, new Date()) ? 'bold' : 'normal',
                                backgroundColor: isSameDate(dayObj.date, new Date()) ? 'var(--accent-weak)' : 'transparent',
                                borderRadius: '50%',
                                display: 'inline-block',
                                width: '24px',
                                height: '24px',
                                lineHeight: '24px',
                                textAlign: 'center',
                                float: 'right'
                            }}>
                                {dayObj.date.getDate()}
                            </div>
                            <div style={{ clear: 'both', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {dayEvents.map(ev => (
                                    <div 
                                        key={ev.id} 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openModalEdit(ev);
                                        }}
                                        style={{ 
                                            backgroundColor: ev.color || 'var(--accent)', 
                                            borderRadius: '3px', 
                                            padding: '2px 4px', 
                                            fontSize: '0.75rem', 
                                            whiteSpace: 'nowrap', 
                                            overflow: 'hidden', 
                                            textOverflow: 'ellipsis',
                                            cursor: 'pointer',
                                            color: 'white'
                                        }} 
                                        title={ev.title}
                                    >
                                        {new Date(ev.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} {ev.title}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };

  return (
    <div className="calendar-container" style={{ height: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', color: 'var(--text-primary)', backgroundColor: 'var(--bg-color)' }}>
      {/* Heavy Header */}
      <header style={{ padding: '20px', borderBottom: '1px solid var(--card-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button 
                onClick={() => navigate('/')} 
                className="back-btn" 
                style={{ 
                    padding: '8px 12px', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border)', 
                    backgroundColor: 'var(--card-bg)', 
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}
            >
                ← Back
            </button>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Calendar</h1>
            <div className="view-controls" style={{ display: 'flex', gap: '5px', backgroundColor: 'var(--card-bg)', padding: '4px', borderRadius: '6px' }}>
                {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
                    <button 
                        key={mode} 
                        onClick={() => {
                            setViewMode(mode);
                            if (mode === 'day') setCurrentDate(new Date());
                        }} 
                        style={{ 
                            padding: '6px 16px', 
                            background: viewMode === mode ? 'var(--accent)' : 'transparent', 
                            border: 'none', 
                            borderRadius: '4px', 
                            color: viewMode === mode ? 'white' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                            fontWeight: viewMode === mode ? 'bold' : 'normal',
                            transition: 'all 0.2s'
                        }}
                    >
                        {mode}
                    </button>
                ))}
            </div>
        </div>
        <div className="nav-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
             <button onClick={handleCreateEventClick} style={{ background: '#22c55e', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}><span>+</span> New Event</button>
             <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--card-bg)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                 <button onClick={handlePrev} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '8px 12px', cursor: 'pointer', borderRight: '1px solid var(--border)' }}>&lt;</button>
                 <span style={{ fontWeight: '600', padding: '0 15px', minWidth: '180px', textAlign: 'center', fontSize: '0.95rem' }}>
                     {viewMode === 'month' 
                        ? currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                        : `${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${viewMode === 'week' ? ` - ${getEndOfWeek(currentDate).getDate()}` : ''}`
                     }
                 </span>
                 <button onClick={handleNext} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '8px 12px', cursor: 'pointer', borderLeft: '1px solid var(--border)' }}>&gt;</button>
             </div>
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {viewMode === 'day' && renderWeekView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'month' && renderMonthView()}
      </div>


      {isModalOpen && (
          <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
              backdropFilter: 'blur(2px)'
          }}>
              <div style={{ backgroundColor: 'var(--card-bg)', padding: '24px', borderRadius: '12px', width: '400px', border: '1px solid var(--border)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.25rem' }}>{modalMode === 'create' ? 'Create Event' : 'Edit Event'}</h3>
                  <form onSubmit={handleSaveEvent}>
                      <div style={{ marginBottom: '15px' }}>
                          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Title</label>
                          <input 
                            type="text" 
                            value={newEventTitle} 
                            onChange={e => setNewEventTitle(e.target.value)} 
                            style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border)', color: 'white', borderRadius: '6px' }}
                            placeholder="Meeting with team..."
                            required
                          />
                      </div>
                      <div style={{ marginBottom: '15px' }}>
                          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Start Time</label>
                          <input 
                            type="datetime-local" 
                            value={newEventStart}
                            onChange={e => setNewEventStart(e.target.value)}
                            style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border)', color: 'white', borderRadius: '6px' }}
                            required
                          />
                      </div>
                      <div style={{ marginBottom: '25px' }}>
                          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>End Time</label>
                          <input 
                            type="datetime-local" 
                            value={newEventEnd}
                            onChange={e => setNewEventEnd(e.target.value)}
                            style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border)', color: 'white', borderRadius: '6px' }}
                            required
                          />
                      </div>
                      <div style={{ marginBottom: '25px' }}>
                          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Color</label>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <input 
                                type="color" 
                                value={newEventColor}
                                onChange={e => setNewEventColor(e.target.value)}
                                style={{ width: '60px', height: '40px', padding: '0', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
                            />
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                {['var(--accent)', 'var(--error)', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'].map(c => (
                                    <div 
                                        key={c}
                                        onClick={() => setNewEventColor(c)}
                                        style={{ 
                                            width: '32px', height: '32px', borderRadius: '50%', backgroundColor: c, cursor: 'pointer',
                                            border: newEventColor === c ? '2px solid white' : '2px solid transparent'
                                        }}
                                    />
                                ))}
                            </div>
                          </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                          <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
                          <button type="submit" style={{ padding: '10px 20px', background: 'var(--accent)', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>Save Event</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}
