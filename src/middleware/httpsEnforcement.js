// HTTPS Enforcement Middleware
// Ensures all production requests use HTTPS

const httpsEnforcement = (req, res, next) => {
  // Skip HTTPS enforcement in development
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Check if the request is already HTTPS
  const isHttps = req.secure || 
                  req.headers['x-forwarded-proto'] === 'https' ||
                  req.headers['x-forwarded-ssl'] === 'on';

  if (!isHttps) {
    console.log(`🔒 Redirecting HTTP to HTTPS: ${req.url}`);
    return res.redirect(301, `https://${req.get('host')}${req.url}`);
  }

  // Set security headers for HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  next();
};

module.exports = httpsEnforcement;
