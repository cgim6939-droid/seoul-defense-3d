// 서울 디펜스 3D 멀티플레이 중계 서버 (Cloudflare Workers + Durable Object)
// 방 코드마다 Durable Object 하나가 방장 ↔ 참가자 메시지를 전달한다.
export class Room {
  constructor() { this.host = null; this.guests = new Map(); }
  async fetch(req) {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    const u = new URL(req.url), role = u.searchParams.get('role'), id = u.searchParams.get('id') || '';
    const [client, ws] = Object.values(new WebSocketPair());
    ws.accept();
    const reply = (o) => { try { ws.send(JSON.stringify(o)); } catch (e) {} };
    if (role === 'host') {
      if (this.host) { reply({ t: 'err', why: 'taken' }); ws.close(); return new Response(null, { status: 101, webSocket: client }); }
      this.host = ws; reply({ t: 'open' });
      ws.addEventListener('message', (e) => {
        let m; try { m = JSON.parse(e.data); } catch (x) { return; }
        if (m.t === 'ping') return;
        const g = this.guests.get(m.to); if (g) { try { g.send(JSON.stringify({ t: 'd', d: m.d })); } catch (x) {} }
      });
      const gone = () => { if (this.host !== ws) return; this.host = null; for (const g of this.guests.values()) { try { g.close(); } catch (x) {} } this.guests.clear(); };
      ws.addEventListener('close', gone); ws.addEventListener('error', gone);
    } else {
      if (!this.host) { reply({ t: 'err', why: 'nohost' }); ws.close(); return new Response(null, { status: 101, webSocket: client }); }
      this.guests.set(id, ws);
      try { this.host.send(JSON.stringify({ t: 'join', id })); } catch (x) {}
      reply({ t: 'open' });
      ws.addEventListener('message', (e) => {
        if (typeof e.data === 'string' && e.data.startsWith('{"t":"ping"')) return;
        if (this.host) { try { this.host.send(JSON.stringify({ t: 'd', from: id, d: e.data })); } catch (x) {} }
      });
      const gone = () => { if (this.guests.get(id) !== ws) return; this.guests.delete(id); if (this.host) { try { this.host.send(JSON.stringify({ t: 'leave', id })); } catch (x) {} } };
      ws.addEventListener('close', gone); ws.addEventListener('error', gone);
    }
    return new Response(null, { status: 101, webSocket: client });
  }
}
export default {
  async fetch(req, env) {
    const m = new URL(req.url).pathname.match(/^\/room\/([A-Za-z0-9]{4,12})$/);
    if (!m) return new Response('sdef3d relay ok', { status: 200 });
    return env.ROOM.get(env.ROOM.idFromName(m[1].toUpperCase())).fetch(req);
  },
};
