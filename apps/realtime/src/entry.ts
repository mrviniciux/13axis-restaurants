import { createRuntime, describeStartupError } from './server.js';

// Entrypoint para Vercel Services: monta o runtime e exporta o http.Server
// sem chamar listen(); a plataforma roteia HTTP/WebSocket para o servidor
// exportado. O listen (dev local e Docker) continua em src/index.ts.
const { httpServer } = await createRuntime(process.env).catch((error: unknown): never => {
  throw new Error(describeStartupError(error));
});

export default httpServer;
