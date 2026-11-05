import {BACKEND} from './config/backend.js';
export async function backend(session,demo=false){
  if(demo){const {DemoBackend}=await import('./demo.js');const r=await fetch(`./config/${encodeURIComponent(session)}.json`);if(!r.ok)throw Error('No existe esa sesión de demostración.');return new DemoBackend(await r.json());}
  return {async call(name,p={}){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    try {
      const response=await fetch(`${BACKEND.url}/rest/v1/rpc/nype_dec_${name}`,{method:'POST',headers:{apikey:BACKEND.key,'Content-Type':'application/json'},body:JSON.stringify({p_session:session,...p}),signal:controller.signal,cache:'no-store'});
      const result=await response.json();
      if(!response.ok){const m=result.message||'No se pudo guardar.';if(/CLOSED|RESET|UNAUTHORIZED/.test(m))throw Error(m);if(result.code==='PGRST202')throw Error('Falta activar esta app en Supabase. Avisale al docente.');throw Error(m);}
      return result;
    }catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw Error('No se pudo conectar. Revisá tu conexión y reintentá.');throw e;}
    finally{clearTimeout(timeout);}
  }};
}
