import net from 'node:net';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set');
}

// Node's default Happy Eyeballs socket connection (autoSelectFamily) uses a
// 250ms per-attempt window. Neon's IPv4 endpoints take longer than that to
// complete a TCP handshake, and hosts without IPv6 routing fail the IPv6
// attempts with ENETUNREACH, so default connections fail intermittently with
// ETIMEDOUT. pg connects via socket.connect(port, host), which has no family
// option, so provide sockets that always connect over IPv4 (family: 4).
function createIpv4Socket(): net.Socket {
  const socket = new net.Socket();
  const originalConnect = socket.connect.bind(socket);
  socket.connect = ((...args: unknown[]) => {
    const [port, host, connectionListener] = args as [
      number,
      string,
      (() => void)?,
    ];
    return originalConnect(
      { port, host, family: 4 },
      connectionListener,
    );
  }) as net.Socket['connect'];
  return socket;
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  stream: () => createIpv4Socket(),
});
export const db = drizzle(pool);
