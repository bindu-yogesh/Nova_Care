import React, { useState, useEffect } from 'react';
import {
  Clock,
  Activity,
  AlertTriangle,
  Sun,
  Dumbbell,
  CheckCircle2,
  PlusCircle,
  Filter,
  FileText
} from 'lucide-react';
import { MissionEvent } from '../types';
import { request } from '../api';

export const TimelineView: React.FC = () => {
  const [events, setEvents] = useState<MissionEvent[]>([]);
  const [filterType, setFilterType] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    eventType: 'eva',
    severity: 'info'
  });
  const [submitting, setSubmitting] = useState(false);

  const loadEvents = () => {
    request<MissionEvent[]>('/api/timeline?limit=50')
      .then(res => setEvents(res || []))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return;
    setSubmitting(true);
    try {
      await request('/api/timeline', {
        method: 'POST',
        body: form
      });
      setShowAddModal(false);
      setForm({
        title: '',
        description: '',
        eventType: 'eva',
        severity: 'info'
      });
      loadEvents();
    } catch (err: any) {
      alert('Failed to log event: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEvents = events.filter(e => {
    if (filterType !== 'all' && e.event_type !== filterType) return false;
    return true;
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'eva': return <Clock size={16} color="var(--cyan)" />;
      case 'medical_alert': return <AlertTriangle size={16} color="var(--health-orange)" />;
      case 'exercise': return <Dumbbell size={16} color="var(--health-green)" />;
      case 'solar_event': return <Sun size={16} color="var(--health-yellow)" />;
      default: return <Activity size={16} color="var(--blue-neon)" />;
    }
  };

  return (
    <div className="page-view">
      <div className="page-header timeline-header">
        <div>
          <h1 className="page-title">
            <Clock color="var(--cyan)" size={24} />
            Mission Activity & Biomedical Timeline
          </h1>
          <p className="page-subtitle">
            Chronological log of spacewalks, medical interventions, exercise compliance, and solar events
          </p>
        </div>

        <div className="timeline-header-controls" style={{ display: 'flex', gap: '10px' }}>
          <select
            style={{ width: 'auto' }}
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="all">All Events</option>
            <option value="eva">EVAs / Spacewalks</option>
            <option value="medical_alert">Medical Alerts</option>
            <option value="exercise">Countermeasures</option>
            <option value="solar_event">Solar Weather</option>
            <option value="protocol_review">Protocols</option>
          </select>

          <button className="btn btn-sm" onClick={() => setShowAddModal(true)}>
            <PlusCircle size={14} /> Log Mission Event
          </button>
        </div>
      </div>

      {/* Timeline Stream */}
      <div className="timeline-stream" style={{ position: 'relative', paddingLeft: '28px', borderLeft: '2px solid var(--border-line)', marginLeft: '12px' }}>
        {filteredEvents.map((ev, index) => {
          const sevColor =
            ev.severity === 'critical' ? 'var(--health-red)' :
            ev.severity === 'warning' ? 'var(--health-orange)' :
            ev.severity === 'success' ? 'var(--health-green)' :
            'var(--cyan)';

          return (
            <div
              key={ev.id || index}
              style={{
                position: 'relative',
                marginBottom: '20px'
              }}
            >
              {/* Timeline Node Dot */}
              <div
                style={{
                  position: 'absolute',
                  left: -37,
                  top: 14,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: 'var(--bg-deep)',
                  border: `2px solid ${sevColor}`,
                  boxShadow: `0 0 10px ${sevColor}66`
                }}
              />

              <div className="glass-card timeline-event-card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {getEventIcon(ev.event_type)}
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', margin: 0 }}>
                      {ev.title}
                    </h3>
                  </div>

                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(ev.created_at).toLocaleString()}
                  </span>
                </div>

                {ev.astronaut_name && (
                  <div style={{ fontSize: '11px', color: 'var(--cyan)', fontWeight: 600, marginBottom: '6px' }}>
                    Crew: {ev.astronaut_name} ({ev.astronaut_callsign || 'CREW'})
                  </div>
                )}

                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  {ev.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content timeline-modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
              Log Mission Timeline Event
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Add entry into official Expedition 03 activity chronology
            </p>

            <form onSubmit={handleAddEvent}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label>Event Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Extravehicular Activity EVA-02 Begun"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                  />
                </div>

                <div className="timeline-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label>Event Category</label>
                    <select
                      value={form.eventType}
                      onChange={e => setForm({ ...form, eventType: e.target.value })}
                    >
                      <option value="eva">EVA / Spacewalk</option>
                      <option value="medical_alert">Medical Alert</option>
                      <option value="exercise">Exercise / Countermeasure</option>
                      <option value="solar_event">Solar / Radiation Event</option>
                      <option value="protocol_review">Protocol Review</option>
                      <option value="checkin">Medical Check-in</option>
                    </select>
                  </div>

                  <div>
                    <label>Severity Level</label>
                    <select
                      value={form.severity}
                      onChange={e => setForm({ ...form, severity: e.target.value })}
                    >
                      <option value="info">Informational</option>
                      <option value="success">Success / Nominal</option>
                      <option value="warning">Warning</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label>Event Description & Mission Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Provide details on crew actions, telemetry observations, or operational milestones..."
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm" disabled={submitting}>
                  {submitting ? 'Logging...' : 'Log Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
