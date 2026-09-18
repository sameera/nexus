/**
 * Starting the renderer a developer runs. Nothing else belongs here — this file is not on the
 * handler artifact's path.
 */
import { startFromEnvironment } from "./listen.js";

const listener = await startFromEnvironment(process.env);

process.stdout.write(`renderer listening at ${listener.url}\n`);
