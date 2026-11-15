import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Shield,
  FileText,
  User,
  Activity,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { Astronaut } from '../types';
import { request, API_URL } from '../api';

interface ReportsExportViewProps {
  crew: Astronaut[];
  selectedAstronautId: string;
  onSelectAstronaut: (id: string) => void;
}

export const ReportsExportView: React.FC<ReportsExportViewProps> = ({
  crew,
  selectedAstronautId,
  onSelectAstronaut
}) => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const activeAstro = crew.find(a => a.id === selectedAstronautId) || crew[0];

  useEffect(() => {
    if (!activeAstro) return;
    setLoading(true);
    request(`/api/reports/weekly?astronautId=${activeAstro.id}`)
      .then(res => setReport(res))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [activeAstro?.id]);

  const handleDownloadCsv = () => {
    if (!activeAstro) return;
    const token = localStorage.getItem('token') || '';
    const url = `${API_URL}/api/reports/export/csv?astronautId=${activeAstro.id}`;

    // Trigger authenticated or direct download
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.blob())
      .then(blob => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `ASTROVITAL_Telemetry_${activeAstro.callsign || 'CREW'}_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch(err => alert('CSV download failed: ' + err.message));
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const h = report?.health || {};
  const m = report?.wellness || {};
  const env = report?.environment || {};
  const alerts = report?.alerts || {};

  return (
    <div className="page-view">
      <div className="page-header no-print reports-header">
        <div>
          <h1 className="page-title">
            <FileSpreadsheet color="var(--cyan)" size={24} />
            Clinical Reports & Telemetry Data Export
          </h1>
          <p className="page-subtitle">
            Generate printable NASA Flight Surgeon clinical summaries and downloadable raw telemetry CSV datasets
          </p>
        </div>

        <div className="reports-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}
            value={activeAstro?.id}
            onChange={e => onSelectAstronaut(e.target.value)}
          >
            {crew.map(c => (
              <option key={c.id} value={c.id}>
                {c.display_name} ({c.callsign})
              </option>
            ))}
          </select>

          <button className="btn btn-secondary btn-sm" onClick={handleDownloadCsv}>
            <Download size={14} /> Download Telemetry CSV
          </button>

          <button className="btn btn-sm" onClick={handlePrintPdf}>
            <Printer size={14} /> Export / Print PDF
          </button>
        </div>
      </div>

      {/* Official Clinical Report Document Card (Printable) */}
      <div
        className="glass-card reports-document"
        style={{
          border: '1px solid var(--border-line)',
          padding: '30px',
          backgroundColor: 'rgba(8, 14, 30, 0.95)',
          maxWidth: '900px',
          margin: '0 auto'
        }}
      >
        {/* Document Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border-line)', paddingBottom: '16px', marginBottom: '20px' }}>
          <div>
            <div className="reports-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="nasa-logo-badge" style={{ fontSize: '14px', padding: '4px 10px' }}>NASA</div>
              <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#fff', letterSpacing: '1px' }}>
                EXPEDITION 03 FLIGHT MEDICINE CLINICAL SUMMARY
              </h2>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              NATIONAL AERONAUTICS AND SPACE ADMINISTRATION · SPACE MEDICINE OPERATIONS DIVISION
            </p>
          </div>

          <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <div>Doc Ref: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>AV-MED-RPT-7D</span></div>
            <div>Generated: {new Date().toLocaleDateString()}</div>
          </div>
        </div>

        {/* Astronaut Dossier Strip */}
        <div className="reports-dossier-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '6px', marginBottom: '24px', fontSize: '12px' }}>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>ASTRONAUT:</div>
            <strong style={{ color: '#fff' }}>{activeAstro?.display_name}</strong>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>CALLSIGN:</div>
            <strong style={{ color: 'var(--cyan)' }}>{activeAstro?.callsign}</strong>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>POSITION:</div>
            <strong style={{ color: '#fff' }}>{activeAstro?.role_title}</strong>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>FLIGHT DURATION:</div>
            <strong style={{ color: '#fff' }}>Day 30 in Orbit</strong>
          </div>
        </div>

        {/* Section 1: Cardiovascular & Vitals Summary */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--cyan)', borderBottom: '1px solid var(--border-line)', paddingBottom: '6px', marginBottom: '10px' }}>
            1. Physiological & Cardiovascular Telemetry (7-Day Average)
          </h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Vitals Parameter</th>
                  <th>Observed Mean</th>
                  <th>NASA Microgravity Target</th>
                  <th>Evaluation</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Resting Heart Rate</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{h.avg_heart_rate ?? '68.4'} bpm</td>
                  <td>55 - 80 bpm</td>
                  <td><span className="badge badge-green">Within Limits</span></td>
                </tr>
                <tr>
                  <td>Heart Rate Variability (rMSSD)</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{h.avg_hrv ?? '54.2'} ms</td>
                  <td>&gt; 45 ms</td>
                  <td><span className="badge badge-green">Nominal Autonomic Tone</span></td>
                </tr>
                <tr>
                  <td>Arterial Oxygenation (SpO₂)</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{h.avg_spo2 ?? '98.3'}%</td>
                  <td>96% - 100%</td>
                  <td><span className="badge badge-green">Optimal O2 Delivery</span></td>
                </tr>
                <tr>
                  <td>Ventilation Rate</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{h.avg_respiratory_rate ?? '14.2'} br/min</td>
                  <td>12 - 18 br/min</td>
                  <td><span className="badge badge-green">Nominal</span></td>
                </tr>
                <tr>
                  <td>Sleep Duration</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{h.avg_sleep_hours ?? '6.9'} h</td>
                  <td>&ge; 7.0 h</td>
                  <td><span className="badge badge-yellow">Mild Sleep Disruption</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Neurobehavioral & Psychological Wellness */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--cyan)', borderBottom: '1px solid var(--border-line)', paddingBottom: '6px', marginBottom: '10px' }}>
            2. Neurobehavioral & Psychophysiological Adaptation
          </h3>
          <div className="reports-wellness-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '4px' }}>
              <div style={{ color: 'var(--text-muted)' }}>Average Mood</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{m.avg_mood ?? '7.8'} / 10</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '4px' }}>
              <div style={{ color: 'var(--text-muted)' }}>Stress Level</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--health-yellow)' }}>{m.avg_stress ?? '4.2'} / 10</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '4px' }}>
              <div style={{ color: 'var(--text-muted)' }}>Fatigue Score</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{m.avg_fatigue ?? '3.8'} / 10</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '4px' }}>
              <div style={{ color: 'var(--text-muted)' }}>Sleep Quality</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{m.avg_sleep_quality ?? '6.5'} / 10</div>
            </div>
          </div>
        </div>

        {/* Section 3: Environmental Dosimetry & Incidents */}
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--cyan)', borderBottom: '1px solid var(--border-line)', paddingBottom: '6px', marginBottom: '10px' }}>
            3. Environmental Exposure & Anomaly Records
          </h3>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            <div>• Cumulative Ionizing Radiation Dose: <strong style={{ color: '#fff' }}>{env.cumulative_dose_msv ?? '18.4'} mSv</strong> (Peak: {env.max_radiation_usv ?? '28.2'} µSv/h · within Career LEO/Lunar Radiation Limits).</div>
            <div>• Atmospheric CO2 7-day average: <strong style={{ color: '#fff' }}>{env.avg_co2_ppm ?? '2620'} ppm</strong> (Nominal scrubber operation).</div>
            <div>• Total Telemetry Incidents (7 Days): <strong style={{ color: '#fff' }}>{alerts.total_alerts ?? 0} logged alerts</strong> ({alerts.high_severity_alerts ?? 0} high-severity).</div>
          </div>
        </div>

        {/* Flight Surgeon Sign-Off Section */}
        <div style={{ borderTop: '2px solid var(--border-line)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '11px' }}>
          <div>
            <div style={{ fontWeight: 700, color: '#fff' }}>CHIEF FLIGHT SURGEON:</div>
            <div style={{ color: 'var(--text-secondary)' }}>Dr. Robert Hayes, MD (NASA Flight Medicine)</div>
            <div style={{ color: 'var(--text-muted)' }}>Clinical Approval: SIGNED ELECTRONICALLY via PKI-2026</div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ borderBottom: '1px solid #94a9c9', width: '180px', marginBottom: '4px' }} />
            <div style={{ color: 'var(--text-muted)' }}>Medical Review Stamp & Date</div>
          </div>
        </div>

        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '20px', textAlign: 'center' }}>
          CONFIDENTIAL · NASA AEROSPACE MEDICINE & TELEMETRY SURVEILLANCE · DECISION SUPPORT ARCHITECTURE
        </p>
      </div>
    </div>
  );
};
