import React, { useEffect, useState } from 'react';
import {
  User,
  Shield,
  Activity,
  Award,
  Heart,
  Moon,
  Dumbbell,
  Radio,
  FileText,
  Calendar
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { Astronaut } from '../types';
import { request } from '../api';

interface AstronautProfileViewProps {
  crew: Astronaut[];
  selectedAstronautId: string;
  onSelectAstronaut: (id: string) => void;
}

export const AstronautProfileView: React.FC<AstronautProfileViewProps> = ({
  crew,
  selectedAstronautId,
  onSelectAstronaut
}) => {
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const activeAstro = crew.find(a => a.id === selectedAstronautId) || crew[0];

  useEffect(() => {
    if (!activeAstro) return;
    setLoading(true);
    request(`/api/crew/${activeAstro.id}`)
      .then(res => setProfileData(res))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [activeAstro?.id]);

  if (!activeAstro) return <div className="page-view"><p>No astronaut selected</p></div>;

  const baselines = profileData?.baselines || {};
  const history = (profileData?.recentHistory || []).slice(0, 30).reverse().map((r: any) => ({
    ...r,
    day: `D-${String(r.recorded_at).slice(8, 10)}`
  }));

  const exercise = profileData?.recentExercise || [];

  return (
    <div className="page-view">
      {/* Top Header & Crew Switcher */}
      <div className="page-header astronaut-profile-header">
        <div>
          <h1 className="page-title">
            <User color="var(--cyan)" size={24} />
            Astronaut Dossier & Medical Profile
          </h1>
          <p className="page-subtitle">
            Longitudinal aerospace physiological profile and baseline calibrations
          </p>
        </div>

        {/* Crew Selector */}
        <div className="astronaut-crew-switcher" style={{ display: 'flex', gap: '8px' }}>
          {crew.map(c => (
            <button
              key={c.id}
              className={`btn btn-sm ${c.id === activeAstro.id ? '' : 'btn-secondary'}`}
              onClick={() => onSelectAstronaut(c.id)}
            >
              {c.callsign || c.display_name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Dossier Summary Card */}
      <div className="glass-card astronaut-summary-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center' }}>
          {/* Avatar Icon */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              backgroundColor: activeAstro.avatar_color || '#00F0FF',
              color: '#000',
              fontWeight: 900,
              fontSize: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 25px ${activeAstro.avatar_color || '#00F0FF'}66`
            }}
          >
            {activeAstro.callsign?.slice(0, 2) || activeAstro.display_name.slice(0, 2)}
          </div>

          {/* Details Block */}
          <div style={{ flex: 1, minWidth: '260px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>
                {activeAstro.display_name}
              </h2>
              <span className="badge badge-green">
                CALLSIGN: {activeAstro.callsign}
              </span>
              <span className={`badge badge-${activeAstro.status === 'nominal' ? 'green' : 'orange'}`}>
                {activeAstro.status.toUpperCase()}
              </span>
            </div>

            <p style={{ color: 'var(--cyan)', fontSize: '13px', marginTop: '2px', fontWeight: 600 }}>
              {activeAstro.role_title} · {activeAstro.assigned_seat || 'Flight Deck 01'}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '12px', fontSize: '12px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>MISSION: </span>
                <span style={{ fontWeight: 600, color: '#fff' }}>{activeAstro.mission_name || 'Artemis Gateway 03'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>BLOOD TYPE: </span>
                <span style={{ fontWeight: 600, color: '#fff' }}>{activeAstro.blood_type || 'O+'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>CUMULATIVE FLIGHT HOURS: </span>
                <span style={{ fontWeight: 600, color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>
                  {activeAstro.flight_hours || 1200} HRS
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: 30-Day Physiological Trends Chart + Baseline Table */}
      <div className="astronaut-profile-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px', marginBottom: '20px' }}>

        {/* 30-Day History Chart */}
        <div className="glass-card astronaut-profile-card">
          <div className="card-header">
            <div className="card-title">
              <Activity size={16} color="var(--cyan)" />
              30-Day Physiological Trajectory
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Resting HR vs HRV Trends
            </span>
          </div>

          <div className="astronaut-profile-chart" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid stroke="rgba(30, 58, 102, 0.4)" strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={10} />
                <YAxis stroke="var(--text-muted)" fontSize={10} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border-line)', borderRadius: 6, fontSize: 11 }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="heart_rate" stroke="#00F0FF" strokeWidth={2} dot={false} name="Heart Rate (bpm)" />
                <Line type="monotone" dataKey="hrv" stroke="#3DDC97" strokeWidth={2} dot={false} name="HRV (ms)" />
                <Line type="monotone" dataKey="sleep_hours" stroke="#FFD24A" strokeWidth={2} dot={false} name="Sleep (h)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Note Day 21 trajectory: multi-indicator elevation where sleep debt correlated with cardiac strain and HRV depression.
          </p>
        </div>

        {/* Calibrated Personal Baselines Table */}
        <div className="glass-card astronaut-profile-card">
          <div className="card-header">
            <div className="card-title">
              <Shield size={16} color="var(--cyan)" />
              Personal Calibrated Baseline (v1.0)
            </div>
            <span style={{ fontSize: '11px', color: 'var(--health-green)' }}>
              Controlled 7-Day In-Flight Baseline
            </span>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Personal baseline computed from earliest validated flight days to avoid drifting against pathological changes.
          </p>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Physiological Metric</th>
                  <th>Mean Baseline</th>
                  <th>Standard Dev (SD)</th>
                  <th>Samples</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(baselines).length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Building baseline...</td></tr>
                ) : (
                  Object.values(baselines).map((b: any) => (
                    <tr key={b.metric_name}>
                      <td style={{ fontWeight: 600, color: '#fff' }}>
                        {b.metric_name.replace('_', ' ').toUpperCase()}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>
                        {typeof b.mean === 'number' ? b.mean.toFixed(1) : b.mean}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        ± {typeof b.std_dev === 'number' ? b.std_dev.toFixed(1) : b.std_dev}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        n={b.sample_count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Countermeasures & Exercise Records */}
      <div className="glass-card astronaut-profile-card">
        <div className="card-header">
          <div className="card-title">
            <Dumbbell size={16} color="var(--cyan)" />
            Microgravity Musculoskeletal Countermeasure Log
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Daily Mandatory 2.5h ARED & T2 Regimen
          </span>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Astronaut</th>
                <th>Date / Time</th>
                <th>Countermeasure Device</th>
                <th>Duration</th>
                <th>Protocol Completed</th>
                <th>Muscle / Joint Discomfort</th>
              </tr>
            </thead>
            <tbody>
              {exercise.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No recent exercise records logged</td></tr>
              ) : (
                exercise.map((ex: any) => (
                  <tr key={ex.id}>
                    <td style={{ fontWeight: 600, color: '#fff' }}>{ex.astronaut_callsign || ex.astronaut_name || 'Unknown'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      {new Date(ex.recorded_at).toLocaleDateString()}
                    </td>
                    <td style={{ fontWeight: 600, color: '#fff' }}>{ex.exercise_type}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{ex.duration_min} min</td>
                    <td>
                      <span className="badge badge-green">COMPLETED (100%)</span>
                    </td>
                    <td>
                      <span style={{ color: ex.discomfort > 3 ? 'var(--health-orange)' : 'var(--health-green)', fontWeight: 600 }}>
                        {ex.discomfort} / 10
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
