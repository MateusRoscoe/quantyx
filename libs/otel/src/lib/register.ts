import { environment } from './env.js';
import { initOtel } from './sdk.js';

if (environment.OTEL_ENABLED) {
  initOtel();
}
