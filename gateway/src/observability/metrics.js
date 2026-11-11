/**
 * Métricas Prometheus. Os nomes e labels de HTTP seguem o padrão do
 * Micrometer/Spring (http_server_requests_seconds com method, uri, status e
 * application), para que os mesmos painéis do Grafana sirvam a Node e Java.
 */
const client = require('prom-client');

const APPLICATION = require('../../package.json').name.replace(/^@shopmesh\//, '');

const register = new client.Registry();
register.setDefaultLabels({ application: APPLICATION });
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_server_requests_seconds',
  help: 'Duração das requisições HTTP recebidas',
  labelNames: ['method', 'uri', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

const kafkaMessagesProcessed = new client.Counter({
  name: 'shopmesh_kafka_messages_processed_total',
  help: 'Mensagens Kafka consumidas, por tópico e resultado',
  labelNames: ['topic', 'outcome'],
  registers: [register],
});

// Usa o padrão da rota (/products/:id), não a URL real, para evitar
// explosão de cardinalidade. Requisições sem rota correspondente viram UNKNOWN.
function routeTemplate(req) {
  if (req.route && req.route.path) {
    return `${req.baseUrl || ''}${req.route.path}`;
  }
  if (req.metricsRoute) {
    return req.metricsRoute;
  }
  return 'UNKNOWN';
}

function httpMetricsMiddleware(req, res, next) {
  if (req.path === '/metrics') {
    return next();
  }

  const stopTimer = httpRequestDuration.startTimer();
  res.on('finish', () => {
    stopTimer({ method: req.method, uri: routeTemplate(req), status: String(res.statusCode) });
  });
  return next();
}

async function metricsHandler(req, res) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}

module.exports = {
  register,
  httpMetricsMiddleware,
  metricsHandler,
  kafkaMessagesProcessed,
};
