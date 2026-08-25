console.error("[igaproxy] preload LOADED");
const http = require("http");
const https = require("https");
const { HttpProxyAgent } = require("http-proxy-agent");
const { HttpsProxyAgent } = require("https-proxy-agent");

const PROXY = "http://127.0.0.1:18080";

http.globalAgent = new HttpProxyAgent(PROXY);
https.globalAgent = new HttpsProxyAgent(PROXY);

const log = (lib, opts) => {
  const url = typeof opts === "string" ? opts : (opts && opts.path ? ((opts.host || opts.hostname) || "") + opts.path : "");
  const agent = opts && opts.agent;
  console.error(`[igaproxy] ${lib}.request -> ${url} agent=${agent && agent.constructor && agent.constructor.name}`);
};
for (const [lib, name] of [[http, "http"], [https, "https"]]) {
  const orig = lib.request.bind(lib);
  lib.request = function (opts, cb) { log(name, opts); return orig(opts, cb); };
}