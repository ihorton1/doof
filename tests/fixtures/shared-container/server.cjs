const http = process.getBuiltinModule("node:http");

http.createServer((request, response) => {
  if (request.url === "/crash") process.exit(17);
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({
    app: process.env.PORT === "3001" ? "bolts" : "doof",
    url: request.url,
    host: request.headers.host,
    protocol: request.headers["x-forwarded-proto"],
    hasDatabase: Boolean(process.env.DATABASE_URL),
    hasBoltsDatabase: Boolean(process.env.BOLTS_DATABASE_URL),
  }));
}).listen(Number(process.env.PORT), process.env.HOSTNAME);
