import { spawn } from "node:child_process";
import { existsSync, realpathSync, readdirSync, readFileSync, writeFileSync, lstatSync } from "node:fs";
import { resolve, join, isAbsolute } from "node:path";
import { createMobileLabGateway } from "./gateway.mjs";

const root = resolve(import.meta.dirname, "..");
if (process.env.NODE_ENV !== "production") throw Error("lab_requires_production_mode");
const required=[
  "LAB_PUBLIC_ORIGIN","LAB_ACCESS_PASSWORD","LAB_SESSION_SECRET",
  "FUNNELPILOT_ADMIN_INGRESS_SECRET","PETE_PROJECT_PRIOR_SPEND_MICRO_USD",
  "LAB_DATA_DIR",
];
for(const key of required) if (!process.env[key]?.trim()) throw Error("missing_"+key);
if (!isAbsolute(process.env.LAB_DATA_DIR)) throw Error("lab_data_dir_must_be_absolute");
if (process.env.LAB_DATA_DIR.startsWith(root+ "/"))
  throw Error("lab_data_dir_must_be_separate");
const dataDir = realpathSync(process.env.LAB_DATA_DIR);
if (dataDir === "/" || dataDir.length < 7) throw Error("lab_data_dir_unsafe");
// Hard stop on a reused real-customer directory. First launch must be empty.
// Later restarts require the exact lab-only marker; do not silently reset.
const marker=join(dataDir,".funnelpilot-private-lab");
if (!existsSync(marker)) {
  // Fresh ext4 volumes can contain an empty filesystem-owned lost+found.
  // Never accept an arbitrary non-empty customer/project data directory.
  const initialEntries = readdirSync(dataDir);
  const otherEntries = initialEntries.filter(name => name !== "lost+found");
  if (otherEntries.length > 0) throw Error("lab_data_dir_not_empty");
  if (initialEntries.includes("lost+found")) {
    const fsRecovery = join(dataDir, "lost+found");
    if (!lstatSync(fsRecovery).isDirectory() || readdirSync(fsRecovery).length > 0) {
      throw Error("lab_volume_recovery_dir_not_empty");
    }
  }
  writeFileSync(marker,"funnelpilot-isolated-synthetic-only-v1\\n",
    {flag:"wx",mode:0o600});
} else if (!lstatSync(marker).isFile() ||
    readFileSync(marker,"utf8")!=="funnelpilot-isolated-synthetic-only-v1\\n") {
  throw Error("lab_data_marker_invalid");
}
const gatewayPort=Number(process.env.PORT ?? "8080");
const backendPort=3011;
if (!Number.isSafeInteger(gatewayPort) || gatewayPort<1024 ||
    gatewayPort>65535 || gatewayPort===backendPort)
  throw Error("invalid_gateway_port");
for (const p of ["backend/dist/index.js","mobile-lab-dist/pete-lab.html"]) {
  if (!existsSync(join(root,p))) throw Error("build_missing_"+p);
}

// Every live social channel is forced OFF for this separate lab instance.
const backendEnv={
  ...process.env,
  NODE_ENV:"production", PORT:String(backendPort), DATA_DIR:dataDir,
  FUNNELPILOT_LOCAL_TEST_MODE:"false",
  PETE_MOBILE_LAB_ENABLED:"true", PETE_MOBILE_LAB_ISOLATED_DATA:"true",
  INSTAGRAM_ENGINE_ENABLED:"false", INSTAGRAM_SEND_ENABLED:"false",
  INSTAGRAM_ALLOW_ALL_SENDERS:"false", INSTAGRAM_AUTO_ENABLE_NEW_LEADS:"false",
  INSTAGRAM_ALLOWED_SENDER_IDS:"",
  WHATSAPP_SEND_ENABLED:"false", WHATSAPP_ALLOW_ALL_RECIPIENTS:"false",
  WHATSAPP_ALLOWED_RECIPIENT_IDS:"",
  ENABLE_GENERIC_WEBHOOKS:"false", DISABLE_DESTRUCTIVE_ROUTES:"true",
  INSTAGRAM_ACCESS_TOKEN:"", INSTAGRAM_ACCOUNT_ID:"",
  INSTAGRAM_APP_SECRET:"", META_ACCESS_TOKEN:"", META_PHONE_NUMBER_ID:"",
  META_APP_SECRET:"", WHATSAPP_ACCESS_TOKEN:"",
};
if(process.env.PETE_LLM_API_CALLS_APPROVED!=="true")
  backendEnv.PETE_LLM_API_CALLS_APPROVED="false";

const backend=spawn(process.execPath, ["backend/dist/index.js"],{
  cwd:root,env:backendEnv,stdio:["ignore","inherit","inherit"],
});
const gateway=createMobileLabGateway({
  publicOrigin:process.env.LAB_PUBLIC_ORIGIN,
  password:process.env.LAB_ACCESS_PASSWORD,
  sessionSecret:process.env.LAB_SESSION_SECRET,
  backendIngressSecret:process.env.FUNNELPILOT_ADMIN_INGRESS_SECRET,
  buildDir:join(root,"mobile-lab-dist"),
  backendOrigin:"http://127.0.0.1:"+backendPort,
});
let shuttingDown=false;
function stop(){
  if(shuttingDown)return;
  shuttingDown=true;
  gateway.close();
  if(!backend.killed)backend.kill("SIGTERM");
}
process.on("SIGINT",stop);
process.on("SIGTERM",stop);
backend.on("exit",(code,signal)=>{
  if(!shuttingDown){
    console.error("[lab] backend stopped",code,signal);
    gateway.close();
    process.exitCode=1;
  }
});
gateway.listen(gatewayPort,"0.0.0.0",()=>{
  console.log("[lab] private test gateway ready on platform port "+gatewayPort);
});
