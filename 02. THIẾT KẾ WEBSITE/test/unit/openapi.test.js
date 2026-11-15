import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const spec=JSON.parse(fs.readFileSync(path.join(root,'public/openapi.json'),'utf8'));

function endpointFiles(dir) {
  const files=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if(entry.name.startsWith('_'))continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())files.push(...endpointFiles(full));
    else if(entry.name.endsWith('.js'))files.push(full);
  }
  return files;
}

// Mỗi tệp trong api/ là một Vercel Serverless Function và tự công bố route của nó
// qua `handler.route` do `endpoint()` trong api/_lib/http.js gắn vào.
const endpoints=[];
for(const file of endpointFiles(path.join(root,'api'))) {
  const module=await import(pathToFileURL(file).href);
  const route=module.default?.route;
  assert.ok(route,`${path.relative(root,file)} phải xuất handler tạo bởi endpoint()`);
  endpoints.push(route);
}

test('OpenAPI covers every non-development API route and HTTP method',()=>{
  assert.equal(spec.openapi,'3.1.0');
  const routes=endpoints
    .filter(route=>!route.internal&&!route.path.startsWith('/api/dev/'))
    .flatMap(route=>route.methods.map(method=>({method:method.toLowerCase(),path:route.path})));
  assert.ok(routes.length>=50,`chỉ tìm thấy ${routes.length} endpoint`);
  for(const route of routes)assert.ok(spec.paths[route.path]?.[route.method],`${route.method.toUpperCase()} ${route.path} is undocumented`);
  for(const [url,item] of Object.entries(spec.paths)) {
    const names=[...url.matchAll(/\{([^}]+)\}/g)].map(match=>match[1]);
    for(const [method,operation] of Object.entries(item)) {
      if(!['get','post','put','patch','delete'].includes(method))continue;
      assert.ok(operation.responses,`${method.toUpperCase()} ${url} needs responses`);
      const parameters=[...(item.parameters||[]),...(operation.parameters||[])].map(parameter=>
        parameter.$ref?spec.components.parameters[parameter.$ref.split('/').at(-1)]:parameter).filter(Boolean);
      for(const name of names)assert.ok(parameters.some(parameter=>parameter.in==='path'&&parameter.name===name),`${method.toUpperCase()} ${url} is missing path parameter ${name}`);
    }
  }
});

test('OpenAPI marks OWNER-only endpoints and webhook credentials',()=>{
  for(const route of endpoints) {
    if(route.internal||route.path.startsWith('/api/dev/'))continue;
    for(const method of route.methods) {
      const roles=Array.isArray(route.roles)?route.roles:route.roles?.[method];
      if(!roles?.includes('OWNER'))continue;
      assert.equal(spec.paths[route.path]?.[method.toLowerCase()]?.['x-required-role'],'OWNER',`${method} ${route.path} must document OWNER role`);
    }
  }
  for(const url of ['/api/webhooks/n8n/session-confirmed','/api/webhooks/n8n/review-submitted'])
    assert.deepEqual(spec.paths[url].post.security,[{webhookSecret:[]}]);
});
