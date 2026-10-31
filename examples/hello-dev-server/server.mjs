import http from 'node:http';
const host = '127.0.0.1';
const port = Number(process.env.PORT || 5173);
http.createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><html><head><title>MCP Dev Test</title></head><body><h1>Hello from local MCP!</h1></body></html>');
}).listen(port, host, () => console.log(`ready: http://${host}:${port}`));
