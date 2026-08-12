/**
 * Activity log route.
 */
const express = require('express');
const { authRequired, requirePerm } = require('../auth');

const router = express.Router();
router.use(authRequired);

router.get('/', requirePerm('activity.view'), (req, res) => {
  const { limit = 50 } = req.query;
  const rows = req.app.locals.db.prepare(`
    SELECT a.*, u.name AS user_name, u.avatar_hue, u.role
    FROM activity a LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC LIMIT ?`).all(Math.min(Number(limit) || 50, 200));
  res.json(rows);
});

module.exports = router;
