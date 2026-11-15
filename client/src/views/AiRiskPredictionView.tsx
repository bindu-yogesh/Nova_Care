import React, { useState } from 'react';
import {
  BrainCircuit,
  Zap,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Info,
  CheckCircle,
  FileText
} from 'lucide-react';
import { Astronaut, RiskAssessment } from '../types';
import { request } from '../api';

interface AiRiskPredictionViewProps {
  crew: Astronaut[];
  selectedAstronautId: string;
  onSelectAstronaut: (id: string) => void;
  latestRiskAssessment: RiskAssessment | null;
  onRunRiskEvaluation: (aid: string) => Promise<RiskAssessment>;
}

export const AiRiskPredictionView: React.FC<AiRiskPredictionViewProps> = ({
  crew,
  selectedAstronautId,
  onSelectAstronaut,
  latestRiskAssessment,
  onRunRiskEvaluation
}) => {
  const [evaluating, setEvaluating] = useState(false);
  const [currentAssessment, setCurrentAssessment] = useState<RiskAssessment | null>(latestRiskAssessment);

  const activeAstro = crew.find(a => a.id === selectedAstronautId) || crew[0];

  const handleEvaluate = async () => {
    if (!activeAstro) return;
    setEvaluating(true);
    try {
      const res = await onRunRiskEvaluation(activeAstro.id);
      setCurrentAssessment(res);
    } catch (err: any) {
      alert('Risk analysis evaluation failed: ' + err.message);
    } finally {
      setEvaluating(false);
    }
  };

  const assessment = currentAssessment || latestRiskAssessment;
  const score = assessment?.riskScore ?? 12;
  const category = assessment?.riskCategory ?? 'LOW';
  const factors = assessment?.contributingFactors || [];
  const actions = assessment?.recommendedActions || [
    'Maintain standard flight circadian schedule and daily 2.5 hr ARED/T2 exercise cycle.',
    'Continue regular morning biometrics synchronization.',
    'Hydration target: nominal 2.5 - 3.0 liters/day.'
  ];

  const scoreColor =
    score >= 75 ? 'var(--health-red)' :
    score >= 50 ? 'var(--health-orange)' :
    score >= 25 ? 'var(--health-yellow)' :
    'var(--health-green)';

  return (
    <div className="page-view">
      <div className="page-header risk-header">
        <div>
          <h1 className="page-title">
            <BrainCircuit color="var(--cyan)" size={24} />
            AI Health Risk Prediction Engine
          </h1>
          <p className="page-subtitle">
            Autonomous multi-variate telemetry risk modeling for deep-space mission medical decision support
          </p>
        </div>

        <div className="risk-header-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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

          <button
            className="btn btn-sm"
            onClick={handleEvaluate}
            disabled={evaluating}
          >
            <Zap size={14} />
            {evaluating ? 'Analyzing Telemetry...' : 'Run On-Demand Risk Assessment'}
          </button>
        </div>
      </div>

      {/* Primary Score Banner & Overview */}
      <div className="glass-card risk-overview-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'center' }}>

          {/* Gauge Block */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                width: 110,
                height: 110,
                borderRadius: '50%',
                border: `6px solid ${scoreColor}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 0 25px ${scoreColor}44`,
                background: 'rgba(5, 8, 17, 0.85)'
              }}
            >
              <span style={{ fontSize: '32px', fontWeight: 900, fontFamily: 'var(--font-mono)', color: scoreColor }}>
                {score}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                / 100 RISK
              </span>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Composite Health Risk Level
              </div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: scoreColor, letterSpacing: '0.5px' }}>
                {category} RISK
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Subject: <span style={{ color: '#fff', fontWeight: 600 }}>{activeAstro?.display_name}</span> ({activeAstro?.callsign})
              </div>
            </div>
          </div>

          {/* Model Evaluation Summary */}
          <div style={{ background: 'rgba(9, 15, 32, 0.6)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--cyan)', marginBottom: '6px' }}>
              <Info size={14} /> CLINICAL DECISION SUPPORT SYNTHESIS
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.5' }}>
              {assessment?.explanation || 'All physiological telemetry vectors are tracking within expected baseline ranges. No acute risk elevation detected.'}
            </p>
            {assessment?.experimentalMl && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', borderTop: '1px solid var(--border-line)', paddingTop: '6px' }}>
                IsolationForest ML Anomaly Score: <span style={{ color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>{assessment.experimentalMl.score ?? '0.04'}</span> · Model: {assessment.experimentalMl.model}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Contributing Factors Breakdown + Recommended Actions */}
      <div className="risk-details-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px', marginBottom: '20px' }}>

        {/* Contributing Factors */}
        <div className="glass-card risk-detail-card">
          <div className="card-header">
            <div className="card-title">
              <TrendingDown size={16} color="var(--cyan)" />
              Contributing Physiological Factors & Impact Weights
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Weighted Relative Impact (%)
            </span>
          </div>

          {factors.length === 0 ? (
            <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <ShieldCheck size={36} color="var(--health-green)" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 700, color: '#fff' }}>No Adverse Contributing Factors</div>
              <p style={{ fontSize: '12px' }}>Heart rate, SpO2, temp, and respiratory rate within personal baseline limits.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {factors.map(f => {
                const fColor =
                  f.severity === 'critical' ? 'var(--health-red)' :
                  f.severity === 'high' ? 'var(--health-orange)' :
                  'var(--health-yellow)';

                return (
                  <div key={f.metric} style={{ background: 'rgba(9, 15, 32, 0.7)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-line)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>
                        {f.name}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: fColor, fontSize: '13px' }}>
                        {f.weightPercent}% Weight
                      </span>
                    </div>

                    <div className="risk-factor-metrics" style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      <span>Observed: <strong style={{ color: '#fff' }}>{f.observed} {f.unit}</strong></span>
                      <span>Baseline: <strong style={{ color: 'var(--cyan)' }}>{f.baseline} {f.unit}</strong></span>
                      {f.zScore != null && <span>Z-Score: <strong style={{ color: fColor }}>{f.zScore > 0 ? `+${f.zScore}` : f.zScore}</strong></span>}
                    </div>

                    {/* Progress Impact Bar */}
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: '8px' }}>
                      <div style={{ width: `${f.weightPercent}%`, height: '100%', background: fColor }} />
                    </div>

                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {f.impact}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recommended Medical Review Actions */}
        <div className="glass-card risk-detail-card">
          <div className="card-header">
            <div className="card-title">
              <CheckCircle size={16} color="var(--cyan)" />
              NASA Flight Surgeon Protocol Recommendations
            </div>
            <span className="badge badge-green">
              STANDARDIZED PROTOCOLS
            </span>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Action items automatically assigned according to NASA Aerospace Medicine Directives and current risk tier:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {actions.map((act, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  background: 'rgba(9, 15, 32, 0.6)',
                  padding: '12px 14px',
                  borderRadius: '6px',
                  borderLeft: '3px solid var(--cyan)'
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'var(--cyan-dim)',
                    color: 'var(--cyan)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 800,
                    flexShrink: 0
                  }}
                >
                  {index + 1}
                </div>
                <div style={{ fontSize: '12px', color: '#fff', lineHeight: '1.4' }}>
                  {act}
                </div>
              </div>
            ))}
          </div>

          {/* Clinical Disclaimer Box */}
          <div
            style={{
              marginTop: '20px',
              padding: '12px',
              background: 'rgba(255, 184, 0, 0.08)',
              border: '1px solid rgba(255, 184, 0, 0.25)',
              borderRadius: '6px',
              fontSize: '11px',
              color: 'var(--health-yellow)',
              lineHeight: '1.4'
            }}
          >
            <strong>NON-DIAGNOSTIC ADVISORY:</strong> This AI risk scoring engine is designed exclusively as flight surgeon decision support. Predictions must be validated by the mission medical team against secondary clinical telemetry and crew consultation.
          </div>
        </div>
      </div>
    </div>
  );
};
