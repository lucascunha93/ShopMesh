const SERVICE_NAME = 'notifications-service';

function safeErrorMessage(error) {
  return error && typeof error.message === 'string'
    ? error.message.replace(/\b[a-z][a-z\d+.-]*:\/\/[^\s"'`]+/gi, '[REDACTED_URL]')
    : undefined;
}

function log(level, message, fields = {}) {
  const output = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  output(JSON.stringify({ level, message, service: SERVICE_NAME, ...fields }));
}

function logHttpFailures(req, res, startedAt) {
  res.on('finish', () => {
    if (res.statusCode < 400) {
      return;
    }

    log(res.statusCode >= 500 ? 'error' : 'warn', 'HTTP request failed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });
}

function logError(message, error, fields = {}) {
  log('error', message, {
    ...fields,
    errorName: error ? error.name || 'Error' : undefined,
    errorMessage: safeErrorMessage(error),
  });
}

module.exports = {
  SERVICE_NAME,
  logHttpFailures,
  logInfo: (message, fields) => log('info', message, fields),
  logWarn: (message, fields) => log('warn', message, fields),
  logError,
  safeErrorMessage,
};
