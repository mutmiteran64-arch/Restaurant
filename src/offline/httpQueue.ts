import { offlineDb } from './offlineDb';

type PendingHttp = { id:string; url:string; method:string; headers:Record<string,string>; body?:string; created_at:string; attempts:number };
const MUTATIONS = new Set(['POST','PATCH','PUT','DELETE']);
export async function enqueueHttp(url:string, init:RequestInit, error:unknown) {
  const method=(init.method||'GET').toUpperCase();
  if(!MUTATIONS.has(method) || !url.includes('/rest/v1/')) throw error;
  const headers:Record<string,string>={};
  new Headers(init.headers).forEach((v,k)=>{ if(k.toLowerCase()!=='authorization') headers[k]=v; });
  await offlineDb.enqueue({operation_id:crypto.randomUUID(),type:'HTTP',resource:'__http__',payload:{url,method,headers,body:typeof init.body==='string'?init.body:undefined},created_at:new Date().toISOString(),attempts:0,status:'pending'} as any);
  return new Response(JSON.stringify({data:null,error:null,queued:true}),{status:202,headers:{'content-type':'application/json'}});
}
