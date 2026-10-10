import { env } from "./config/env.js";
import app from "./app.js";

// Do not expose the local dashboard/admin API to the Wi-Fi network.
// Production networking is handled separately by the deployment reverse proxy.
const listenHost = env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";

app.listen(env.PORT, listenHost, () => {
  console.log(`✅ Backend läuft auf http://${listenHost}:${env.PORT}`);
});
