import assert from "node:assert/strict";
import test from "node:test";
import { createServer, request as rawHttpRequest } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMobileLabGateway } from "./gateway.mjs";

function listen(server, port = 0) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const value=server.address();
      assert.ok(value && typeof value==="object");
      resolve(value.port);
    });
  });
}
function close(server) {
  return new Promise((resolve,reject) =>
    server.close(error => error ? reject(error) : resolve()));
}
const password="temporary test passphrase 2026 only";
const sessionSecret="test-session-secret-is-at-least-32-characters";
const ingressSecret="test-internal-ingress-secret-has-32-chars";

test("gateway requires strong credentials and localhost backend", () => {
  assert.throws(() => createMobileLabGateway({
    publicOrigin:"http://localhost:8080",password,sessionSecret,backendIngressSecret:ingressSecret
  }),/https/);
  assert.throws(() => createMobileLabGateway({
    publicOrigin:"https://example.com",password:"short",sessionSecret,backendIngressSecret:ingressSecret
  }),/secrets/);
  assert.throws(() => createMobileLabGateway({
    publicOrigin:"https://example.com",password,sessionSecret,backendIngressSecret:ingressSecret,
    backendOrigin:"https://example.com"
  }),/loopback/);
});

test("private mobile gateway denies admin and requires session + same-origin posts", async () => {
  const tmp=mkdtempSync(join(tmpdir(),"fp-lab-gateway-"));
  mkdirSync(join(tmp,"assets"),{recursive:true});
  writeFileSync(join(tmp,"pete-lab.html"),"<!doctype html><title>Pete Testlabor</title>");
  writeFileSync(join(tmp,"pete-lab.webmanifest"),'{"start_url":"/pete-test"}');
  writeFileSync(join(tmp,"assets","lab-test.js"),"console.log('test')");
  const received=[];
  const backend=createServer(async(req,res)=>{
    received.push({path:req.url,method:req.method,secret:req.headers["x-funnelpilot-admin-ingress"]});
    res.setHeader("content-type","application/json");
    res.end(JSON.stringify({ok:true,hardCapUsd:8,committedUsd:4.323801,
      confirmedUsd:4.323801,reservedUsd:0,remainingUsd:3.676199}));
  });
  let gateway;
  try {
    const backendPort=await listen(backend);
    // Reserve unique port for exact host/origin checking.
    const reserver=createServer((_req,res)=>res.end());
    const publicPort=await listen(reserver);
    await close(reserver);
    const origin="http://127.0.0.1:"+publicPort;
    gateway=createMobileLabGateway({
      publicOrigin:origin,password,sessionSecret,backendIngressSecret:ingressSecret,
      buildDir:tmp,backendOrigin:"http://127.0.0.1:"+backendPort,
      allowHttpForTests:true,
    });
    await listen(gateway,publicPort);
    const get=(path,opts={})=>fetch(origin+path,{redirect:"manual",...opts});
    let result=await get("/healthz",{headers:{host:"railway-healthcheck"}});
    assert.equal(result.status,200);
    assert.equal(await result.text(),"ok");
    const untrustedHostStatus = await new Promise((resolve,reject) => {
      const req = rawHttpRequest({host:"127.0.0.1",port:publicPort,path:"/pete-test",
        headers:{Host:"untrusted.example"}}, res => {
          res.resume();
          res.on("end", () => resolve(res.statusCode));
        });
      req.on("error", reject);
      req.end();
    });
    assert.equal(untrustedHostStatus,421);
    result=await get("/pete-test");
    assert.equal(result.status,303);
    assert.equal(result.headers.get("location"),"/lab-login");
    result=await get("/test-chat/lab/budget");
    assert.equal(result.status,401);
    assert.equal(received.length,0,"backend should not receive anonymous requests");
    const extractCsrf=async response => {
      const page=await response.text();
      assert.match(page,/Testlabor-Passwort/);
      const match=/name="csrf_token" value="([^"]+)"/.exec(page);
      assert.ok(match,"login form must include hidden CSRF token");
      assert.equal(response.headers.get("set-cookie"),null,
        "login form must not depend on browser cookie persistence");
      return {token:match[1]};
    };
    result=await get("/lab-login");
    assert.equal(result.status,200);
    let loginCsrf=await extractCsrf(result);
    const login=(secret, reqOrigin=origin, options={})=>{
      const headers={"content-type":"application/x-www-form-urlencoded"};
      if(options.cookie) headers.cookie=options.cookie;
      if(reqOrigin!==null)headers.origin=reqOrigin;
      if(options.fetchSite)headers["sec-fetch-site"]=options.fetchSite;
      return get("/lab-login",{
        method:"POST",headers,
        body:new URLSearchParams({
          password:secret,
          csrf_token:options.csrf ?? loginCsrf.token,
        }),
      });
    };
    result=await login(password,"https://evil.example");
    assert.equal(result.status,403);
    result=await login(password,null,{fetchSite:"cross-site"});
    assert.equal(result.status,403,"cross-site browser form forbidden");
    result=await login(password,null,{csrf:"wrong"});
    assert.equal(result.status,403,"no access with invalid CSRF even correct password");
    loginCsrf=await extractCsrf(result);
    result=await login("wrong test password!",null);
    assert.equal(result.status,401,"Android missing-origin POST reaches password checker");
    loginCsrf=await extractCsrf(result);
    result=await login(password,null,{csrf:loginCsrf.token});
    assert.equal(result.status,303,"Android missing-origin POST succeeds without a login cookie");
    assert.match(result.headers.get("set-cookie"),/__Host-pete_lab=/);
    assert.equal(result.headers.get("location"),"/pete-test");
    const cookieHeader=result.headers.get("set-cookie");
    assert.match(cookieHeader,/HttpOnly/);
    assert.match(cookieHeader,/SameSite=Strict/);
    assert.match(cookieHeader,/__Host-pete_lab=/);
    const cookie=cookieHeader.split(";")[0];
    const withLogin=(path,opts={})=>get(path,{
      ...opts, headers:{cookie,...opts.headers},
    });

    result=await withLogin("/pete-test");
    assert.equal(result.status,200);
    assert.equal(result.headers.get("permissions-policy"),
      "camera=(), microphone=(self), geolocation=()");
    assert.match(await result.text(),/Pete Testlabor/);
    result=await withLogin("/pete-lab.webmanifest");
    assert.equal(result.status,200);
    result=await withLogin("/assets/lab-test.js");
    assert.equal(result.status,200);

    for (const denied of [
      "/leads", "/settings-config", "/conversations", "/test-chat/message",
      "/test-chat/budget", "/webhooks/meta/instagram",
      "/test-chat/lab/state/real-user-12345678",
      "/assets/../../backend/package.json", "/package.json",
    ]) {
      result=await withLogin(denied);
      assert.equal(result.status,404,"forbid "+denied);
    }
    assert.equal(received.length,0,"no non-lab routes forwarded");

    result=await withLogin("/test-chat/lab/budget");
    assert.equal(result.status,200);
    assert.equal((await result.json()).remainingUsd,3.676199);
    assert.equal(received[0].secret,ingressSecret);
    assert.equal(received[0].path,"/test-chat/lab/budget");

    result=await withLogin("/test-chat/lab/state/lab_123456789012345678901234");
    assert.equal(result.status,200);
    assert.equal(received[1].path,"/test-chat/lab/state/lab_123456789012345678901234");

    result=await withLogin("/test-chat/lab/message",{
      method:"POST",headers:{"content-type":"application/json",origin:"https://evil.example"},
      body:JSON.stringify({leadId:"lab_123456789012345678901234",messageText:"Hallo"}),
    });
    assert.equal(result.status,403);
    result=await withLogin("/test-chat/lab/message",{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({leadId:"lab_123456789012345678901234",messageText:"Hallo"}),
    });
    assert.equal(result.status,403,"real API still requires exact Origin");
    result=await withLogin("/test-chat/lab/message",{
      method:"POST",headers:{"content-type":"application/json",origin},
      body:JSON.stringify({leadId:"lab_123456789012345678901234",messageText:"Hallo"}),
    });
    assert.equal(result.status,200);
    assert.equal(received.length,3);
    assert.equal(received[2].method,"POST");
    assert.equal(received[2].secret,ingressSecret);
    result=await withLogin("/test-chat/lab/message",{
      method:"POST",headers:{"content-type":"application/json",origin},
      body:"x".repeat(5000),
    });
    assert.equal(result.status,503); // bounded gateway body, backend never reached
    assert.equal(received.length,3);
    result=await withLogin("/lab-logout",{method:"POST",headers:{origin}});
    assert.equal(result.status,303);
    assert.match(result.headers.get("set-cookie"),/Max-Age=0/);
  } finally {
    if (gateway?.listening) await close(gateway);
    if (backend.listening) await close(backend);
    rmSync(tmp,{recursive:true,force:true});
  }
});
