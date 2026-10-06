function logHttpFailures(req, res, startedAt) {
  res.on('finish', () => {
    if (res.statusCode < 400) {
      return;
    }

    const log = res.statusCode >= 500 ? console.error : console.warn;
    log(JSON.stringify({
      level: res.statusCode >= 500 ? 'error' : 'warn',
      message: 'HTTP request failed',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    }));
  });
}

function logRequestError(error, req, status) {
  console.error(JSON.stringify({
    level: 'error',
    message: 'Unhandled request error',
    method: req.method,
    path: req.path,
    status,
    errorName: error.name || 'Error',
    errorCode: typeof error.code === 'string' ? error.code : undefined,
    errorMessage: safeErrorMessage(error),
  }));
}

function safeErrorMessage(error) {
  return typeof error.message === 'string'
    ? error.message.replace(/\b[a-z][a-z\d+.-]*:\/\/[^\s"'`]+/gi, '[REDACTED_URL]')
    : undefined;
}

module.exports = { logHttpFailures, logRequestError };
