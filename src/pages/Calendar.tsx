import React, { useState } from 'react';
import { useCalendar } from '../hooks';
import './Calendar.css';

export default function Calendar() {
  const { events, loading, error } = useCalendar();
  const [currentDate, setCurrentDate] = useState(new Date());

  if (loading) return <div className="page-loading">Loading calendar…</div>;
  if (error) return <div className="page-error">{error}</div>;

  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth(currentDate) }, (_, i) => i + 1);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  const getEventsForDay = (day: number) => {
    return events?.filter(e => {
      const eventDate = new Date(e.event_date);
      return eventDate.getDate() === day && eventDate.getMonth() === currentDate.getMonth();
    }) || [];
  };

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Calendar</h1>
        <p>Schedule and manage events</p>
      </div>

      <div className="calendar-container">
        <div className="calendar-header">
          <button onClick={prevMonth}>←</button>
          <h2>{monthName}</h2>
          <button onClick={nextMonth}>→</button>
        </div>

        <div className="weekdays">
          <div className="weekday">Sun</div>
          <div className="weekday">Mon</div>
          <div className="weekday">Tue</div>
          <div className="weekday">Wed</div>
          <div className="weekday">Thu</div>
          <div className="weekday">Fri</div>
          <div className="weekday">Sat</div>
        </div>

        <div className="calendar-grid">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="calendar-day empty"></div>
          ))}
          {days.map(day => {
            const dayEvents = getEventsForDay(day);
            return (
              <div key={day} className="calendar-day">
                <div className="day-number">{day}</div>
                <div className="day-events">
                  {dayEvents.slice(0, 2).map(e => (
                    <div key={e.id} className="event-dot" title={e.title}></div>
                  ))}
                  {dayEvents.length > 2 && <small>+{dayEvents.length - 2}</small>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="events-list">
        <h3>Upcoming Events</h3>
        {events && events.length > 0 ? (
          <div className="event-items">
            {events.slice(0, 10).map(event => (
              <div key={event.id} className="event-item">
                <div className="event-time">{new Date(event.event_date).toLocaleDateString()}</div>
                <div className="event-title">{event.title}</div>
                <div className="event-desc">{event.description}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No events scheduled</div>
        )}
      </div>
    </div>
  );
}
