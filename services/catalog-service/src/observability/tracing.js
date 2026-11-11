/**
 * Tracing distribuído com OpenTelemetry (exportação OTLP/HTTP para o Jaeger).
 *
 * Deve ser carregado antes de express, http e kafkajs para que a
 * instrumentação consiga interceptar esses módulos. Fica desligado a menos
 * que TRACING_ENABLED=true. O endpoint vem de OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
 * (padrão http://localhost:4318/v1/traces).
 */
const SERVICE_NAME = require('../../package.json').name.replace(/^@shopmesh\//, '');

// Instrumentações opcionais: cada serviço instala só as que usa.
const OPTIONAL_INSTRUMENTATIONS = [
  ['@opentelemetry/instrumentation-http', 'HttpInstrumentation', {
    // Health checks e scraping do Prometheus não geram traces.
    ignoreIncomingRequestHook: (request) => ['/health', '/metrics'].includes(request.url),
  }],
  ['@opentelemetry/instrumentation-express', 'ExpressInstrumentation'],
  ['@opentelemetry/instrumentation-kafkajs', 'KafkaJsInstrumentation'],
  ['@opentelemetry/instrumentation-mongodb', 'MongoDBInstrumentation'],
];

function loadInstrumentations() {
  return OPTIONAL_INSTRUMENTATIONS.flatMap(([moduleName, exportName, options]) => {
    try {
      const Instrumentation = require(moduleName)[exportName];
      return [new Instrumentation(options)];
    } catch {
      return [];
    }
  });
}

function startTracing() {
  if (process.env.TRACING_ENABLED !== 'true') {
    return null;
  }

  const { NodeSDK } = require('@opentelemetry/sdk-node');
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
  const { resourceFromAttributes } = require('@opentelemetry/resources');

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({ 'service.name': process.env.OTEL_SERVICE_NAME || SERVICE_NAME }),
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
    }),
    instrumentations: loadInstrumentations(),
  });
  sdk.start();

  async function shutdown() {
    try {
      await sdk.shutdown();
    } catch {
      // O encerramento do processo não deve falhar por causa do exportador.
    }
  }
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  return sdk;
}

module.exports = startTracing();
