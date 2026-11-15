import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Volume2, VolumeX, LogOut, UserCheck, Clock, Satellite, Menu } from 'lucide-react';
import { HealthAlert } from '../types';

interface NavbarProps {
  userRole: string;
  userName: string;
  missionDay: number;
  openAlerts: HealthAlert[];
  onOpenNotifications: () => void;
  onOpenMenu: () => void;
  onQuickSwitchUser: (email: string) => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  userRole,
  userName,
  missionDay,
  openAlerts,
  onOpenNotifications,
  onOpenMenu,
  onQuickSwitchUser,
  onLogout
}) => {
  const [utcTime, setUtcTime] = useState<string>('');
  const [metTime, setMetTime] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const knownAlertIdsRef = useRef<Set<string>>(new Set());

  const playAlertChime = useCallback(() => {
    try {
      const AudioContextConstructor =
        window.AudioContext || (window as any).webkitAudioContext;

      if (!AudioContextConstructor) return;

      const context =
        audioContextRef.current ?? new AudioContextConstructor();

      audioContextRef.current = context;

      if (context.state === 'suspended') {
        void context.resume();
      }

      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, now);
      oscillator.frequency.setValueAtTime(1174.66, now + 0.12);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start(now);
      oscillator.stop(now + 0.4);
    } catch (error) {
      console.warn('Audio alert playback unavailable:', error);
    }
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().slice(17, 25) + ' UTC');

      // MET: Day [missionDay] + HH:MM:SS
      const hrs = String(now.getUTCHours()).padStart(2, '0');
      const min = String(now.getUTCMinutes()).padStart(2, '0');
      const sec = String(now.getUTCSeconds()).padStart(2, '0');
      setMetTime(`MET ${String(missionDay).padStart(2, '0')}:${hrs}:${min}:${sec}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [missionDay]);

  const toggleSound = () => {
    const nextEnabled = !soundEnabled;
    setSoundEnabled(nextEnabled);

    if (nextEnabled) {
      playAlertChime();
    }
  };

  useEffect(() => {
    const currentIds = new Set(openAlerts.map(alert => alert.id));
    const hasNewAlert = openAlerts.some(
      alert => !knownAlertIdsRef.current.has(alert.id)
    );

    knownAlertIdsRef.current = currentIds;

    if (soundEnabled && hasNewAlert) {
      playAlertChime();
    }
  }, [openAlerts, soundEnabled, playAlertChime]);

  useEffect(() => {
    return () => {
      const context = audioContextRef.current;
      if (context && context.state !== 'closed') {
        void context.close();
      }
    };
  }, []);

  return (
    <header className="flight-bar no-print">
      <button
        className="mobile-menu-toggle"
        type="button"
        aria-label="Open navigation menu"
        onClick={onOpenMenu}
      >
        <Menu size={20} />
      </button>
      <div className="flight-telemetry-strip">
        <div className="telemetry-item">
          <span className="telemetry-label">Mission Elapsed Time</span>
          <span className="telemetry-value" style={{ color: 'var(--cyan)' }}>
            <Clock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {metTime}
          </span>
        </div>

        <div className="telemetry-item">
          <span className="telemetry-label">Station Zulu Time</span>
          <span className="telemetry-value" style={{ color: '#fff' }}>
            {utcTime}
          </span>
        </div>

        <div className="telemetry-item" style={{ display: 'none', md: 'flex' } as any}>
          <span className="telemetry-label">Station Orbit</span>
          <span className="telemetry-value" style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
            <Satellite size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            DRO-420km · 51.6° INC
          </span>
        </div>

        <div className="live-indicator">
          <div className="live-dot" />
          <span>SYS NOMINAL</span>
        </div>
      </div>

      <div className="top-actions">
        {/* Audio Alert Toggle */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={toggleSound}
          title={soundEnabled ? 'Mute alert chime' : 'Enable audio alerts'}
          style={{ padding: '6px 8px' }}
        >
          {soundEnabled ? <Volume2 size={15} color="var(--cyan)" /> : <VolumeX size={15} color="var(--text-muted)" />}
        </button>

        {/* Notifications Tray */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onOpenNotifications}
          style={{ position: 'relative', padding: '6px 8px' }}
          title="Open Alerts & Notification Center"
        >
          <Bell size={15} />
          {openAlerts.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                background: 'var(--health-red)',
                color: '#fff',
                borderRadius: '50%',
                width: 16,
                height: 16,
                fontSize: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                boxShadow: '0 0 8px rgba(255, 45, 85, 0.7)'
              }}
            >
              {openAlerts.length}
            </span>
          )}
        </button>

        {/* User Identity Pill */}
        <div className="user-profile-pill top-user-pill">
          <UserCheck size={14} color="var(--cyan)" />
          <span style={{ fontWeight: 600 }}>{userName}</span>
          <span className="role-tag">
            {userRole === 'medical' ? 'FLIGHT SURGEON' : 'ASTRONAUT'}
          </span>
        </div>

        {/* Quick Demo Switcher */}
        <select
          className="top-role-switcher"
          style={{ width: 'auto', padding: '4px 8px', fontSize: '11px', background: 'var(--bg-panel)', borderColor: 'var(--border-line)' }}
          onChange={e => {
            if (e.target.value) onQuickSwitchUser(e.target.value);
          }}
          value=""
        >
          <option value="" disabled>Switch Role...</option>
          <option value="astro@demo.space">Cmdr. Sarah Vance (Astro)</option>
          <option value="medical@demo.space">Dr. Hayes (Flight Surgeon)</option>
          <option value="pilot@demo.space">Lt. Col. Marcus Chen (Pilot)</option>
          <option value="engineer@demo.space">David Okafor (Engineer)</option>
        </select>

        {/* Logout */}
        <button
          className="btn btn-secondary btn-sm top-logout-button"
          onClick={onLogout}
          title="Sign Out"
          style={{ padding: '6px 8px' }}
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
};
