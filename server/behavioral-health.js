
import express from 'express';
import { analyzeSentiment } from './behavioral-sentiment.js';

const MOODS = ['Very Good', 'Good', 'Neutral', 'Low', 'Very Low'];
const LOW_MOODS = new Set(['Low', 'Very Low']);

const wrap = handler => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export function createBehavioralHealthRouter({ auth, q }) {
  const router = express.Router();

  // Allow astronauts and flight surgeons.
  // Each account can access only its own records.
  const requireBehavioralHealthAccess = async (req, res, next) => {
    try {
      const uid = req.user?.uid;
      const role = req.user?.role;

      if (!uid) {
        return res.status(401).json({
          error: 'Authenticated user information is missing.'
        });
      }

      if (!['astronaut', 'medical'].includes(role)) {
        return res.status(403).json({
          error: 'Behavioral health access is restricted to astronauts and flight surgeons.'
        });
      }

      req.behavioralUserId = uid;
      req.behavioralAstronautId = null;

      // Verify ownership of the astronaut profile.
      // Flight Surgeons do not need an astronaut profile.
      if (role === 'astronaut') {
        const aid = req.user?.aid;

        if (!aid) {
          return res.status(403).json({
            error: 'An astronaut profile is required.'
          });
        }

        const [astronaut] = await q(
          'SELECT id FROM astronauts WHERE id=$1 AND user_id=$2',
          [aid, uid]
        );

        if (!astronaut) {
          return res.status(403).json({
            error: 'Access to this astronaut profile is not permitted.'
          });
        }

        req.behavioralAstronautId = astronaut.id;
      }

      next();
    } catch (error) {
      next(error);
    }
  };

  router.use(auth(), requireBehavioralHealthAccess);

  // 1. Submit a check-in.
  router.post('/checkins', wrap(async (req, res) => {
    const { mood, stressLevel, journalEntry = '' } = req.body || {};

    if (!MOODS.includes(mood)) {
      return res.status(400).json({
        error: 'Please select a valid mood.'
      });
    }

    if (
      stressLevel !== undefined &&
      stressLevel !== null &&
      (!Number.isInteger(stressLevel) ||
        stressLevel < 1 ||
        stressLevel > 10)
    ) {
      return res.status(400).json({
        error: 'Stress level must be an integer between 1 and 10.'
      });
    }

    if (
      typeof journalEntry !== 'string' ||
      journalEntry.length > 2000
    ) {
      return res.status(400).json({
        error: 'Journal entry must be text with at most 2000 characters.'
      });
    }

    const trimmedJournal = journalEntry.trim();
    const analysis = analyzeSentiment(trimmedJournal);

    const [record] = await q(
      `INSERT INTO behavioral_health_checkins
        (user_id, astronaut_id, mood, stress_level, journal_entry, sentiment)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, mood, stress_level, journal_entry,
                 sentiment, created_at`,
      [
        req.behavioralUserId,
        req.behavioralAstronautId,
        mood,
        stressLevel ?? null,
        trimmedJournal,
        trimmedJournal ? analysis.sentiment : null
      ]
    );

    res.status(201).json({
      checkin: record,
      sentimentAnalysis: analysis
    });
  }));

  // 2. Retrieve only this account's history.
  router.get('/history', wrap(async (req, res) => {
    const requestedLimit = Number(req.query.limit ?? 30);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 30;

    const records = await q(
      `SELECT id, mood, stress_level, journal_entry,
              sentiment, created_at
       FROM behavioral_health_checkins
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.behavioralUserId, limit]
    );

    res.json({ records });
  }));

  // 3. Weekly or monthly statistics.
  router.get('/stats', wrap(async (req, res) => {
    const period = req.query.period || 'week';

    if (!['week', 'month'].includes(period)) {
      return res.status(400).json({
        error: 'Period must be week or month.'
      });
    }

    const days = period === 'week' ? 7 : 30;

    const records = await q(
      `SELECT
         DATE(created_at) AS date,
         COUNT(*)::int AS checkin_count,
         ROUND(AVG(
           CASE mood
             WHEN 'Very Good' THEN 5
             WHEN 'Good' THEN 4
             WHEN 'Neutral' THEN 3
             WHEN 'Low' THEN 2
             WHEN 'Very Low' THEN 1
           END
         ), 2) AS average_mood_score
       FROM behavioral_health_checkins
       WHERE user_id = $1
         AND created_at >= NOW() - ($2 * INTERVAL '1 day')
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) ASC`,
      [req.behavioralUserId, days]
    );

    const [summary] = await q(
      `SELECT
         COUNT(*)::int AS total_checkins,
         ROUND(AVG(
           CASE mood
             WHEN 'Very Good' THEN 5
             WHEN 'Good' THEN 4
             WHEN 'Neutral' THEN 3
             WHEN 'Low' THEN 2
             WHEN 'Very Low' THEN 1
           END
         ), 2) AS average_mood_score
       FROM behavioral_health_checkins
       WHERE user_id = $1
         AND created_at >= NOW() - ($2 * INTERVAL '1 day')`,
      [req.behavioralUserId, days]
    );

    res.json({
      period,
      days,
      summary,
      trends: records
    });
  }));

  // 4. Detect three consecutive low-mood check-ins.
  router.get('/alerts', wrap(async (req, res) => {
    const recent = await q(
      `SELECT mood, created_at
       FROM behavioral_health_checkins
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 3`,
      [req.behavioralUserId]
    );

    const repeatedLowMood =
      recent.length === 3 &&
      recent.every(record => LOW_MOODS.has(record.mood));

    const alerts = repeatedLowMood
      ? [{
          type: 'repeated_low_mood',
          severity: 'gentle',
          title: 'Wellness check-in',
          message:
            'Your last three check-ins indicate lower moods. Consider taking a moment for self-care or reaching out to someone you trust.',
          informational: true
        }]
      : [];

    res.json({ alerts });
  }));

  return router;
}
