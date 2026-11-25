// middleware/roleMiddleware.js
// Provides role‑based access control utilities.

/** Middleware generator that checks if the authenticated user has one of the allowed roles.
 *  Usage: app.get('/some', requireAuth, requireRole(['kader','puskesmas']), handler);
 */
function requireRole(allowedRoles) {
  // allowedRoles can be a string or array of strings
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ status: 'error', message: 'Tidak terautentikasi.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ status: 'error', message: 'Akses ditolak: hak akses tidak mencukupi.' });
    }
    next();
  };
}

module.exports = { requireRole };