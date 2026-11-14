import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const spec=JSON.parse(fs.readFileSync(path.join(root,'docs/openapi.json'),'utf8'));
const server=fs.readFileSync(path.join(root,'src/server.js'),'utf8');

test('OpenAPI covers every non-development API route and HTTP method',()=>{
  assert.equal(spec.openapi,'3.1.0');
  const routes=[...server.matchAll(/route\('(GET|POST|PUT|PATCH|DELETE)','([^']+)'[^\n]*/g)]
    .map(match=>({method:match[1].toLowerCase(),path:match[2].replace(/:([A-Za-z0-9_]+)/g,'{$1}'),line:match[0]}))
    .filter(route=>!route.path.startsWith('/api/dev/'));
  assert.ok(routes.length>=50);
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
  const ownerRoutes=[...server.matchAll(/route\('(GET|POST|PUT|PATCH|DELETE)','([^']+)'[^\n]*roles:\['OWNER'\][^\n]*/g)];
  for(const route of ownerRoutes) {
    const url=route[2].replace(/:([A-Za-z0-9_]+)/g,'{$1}');
    assert.equal(spec.paths[url]?.[route[1].toLowerCase()]?.['x-required-role'],'OWNER',`${route[1]} ${url} must document OWNER role`);
  }
  for(const url of ['/api/webhooks/n8n/session-confirmed','/api/webhooks/n8n/review-submitted'])
    assert.deepEqual(spec.paths[url].post.security,[{webhookSecret:[]}]);
});
