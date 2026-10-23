import { DurableObject } from "cloudflare:workers";

interface Env {
  ARENA_ROOMS: DurableObjectNamespace;
}

type LootKind = "rifle" | "shotgun" | "ammo" | "medkit";
type LootItem = { id: string; kind: LootKind; name: string; x: number; z: number; amount: number };
type InventoryItem = { id: string; kind: LootKind; name: string; amount?: number };
type Player = {
  id: string;
  name: string;
  team: "blue" | "red";
  x: number;
  z: number;
  yaw: number;
  hp: number;
  alive: boolean;
  kills: number;
  inventory: InventoryItem[];
  ammo: { loaded: number; reserve: number };
  lastMove: number;
  lastShot: number;
  connectedAt: number;
};

type ClientMessage =
  | { type: "join"; name?: string; team?: "blue" | "red" }
  | { type: "move"; x?: number; z?: number; yaw?: number; sprint?: boolean }
  | { type: "shoot"; targetId?: string | null; weaponIndex?: number }
  | { type: "pickup"; itemId?: string }
  | { type: "drop"; itemId?: string }
  | { type: "reload" }
  | { type: "use"; itemId?: string }
  | { type: "team"; team?: "blue" | "red" };

const cleanName = (value: unknown) =>
  String(value || "Ranger").replace(/[<>\\u0000-\\u001f]/g, "").trim().slice(0, 24) || "Ranger";

const distance = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);

function seedLoot(): LootItem[] {
  const loot: LootItem[] = [];
  const kinds: LootKind[] = ["rifle", "ammo", "medkit", "shotgun", "ammo", "medkit", "rifle", "ammo", "shotgun", "medkit", "ammo", "rifle", "ammo", "medkit"];
  for (let i = 0; i < kinds.length; i++) {
    const angle = i * 2.399963;
    const radius = 10 + (i % 7) * 10;
    const kind = kinds[i];
    loot.push({
      id: "loot-" + i,
      kind,
      name: kind === "rifle" ? "Assault Rifle" : kind === "shotgun" ? "Pump Shotgun" : kind === "ammo" ? "Ammo Pack" : "Medkit",
      x: Math.round(Math.cos(angle) * radius * 10) / 10,
      z: Math.round(Math.sin(angle) * radius * 10) / 10,
      amount: kind === "ammo" ? 30 : kind === "medkit" ? 1 : 1
    });
  }
  return loot;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return Response.json({ service: "island-arena-realtime", status: "ok", transport: "websocket" });
    }
    if (!url.pathname.startsWith("/room/")) {
      return Response.json({ error: "Use /room/<room-code>" }, { status: 404 });
    }
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return Response.json({ error: "WebSocket upgrade required" }, { status: 426 });
    }
    const room = url.pathname.slice("/room/".length).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "public";
    const id = env.ARENA_ROOMS.idFromName(room.toLowerCase());
    return env.ARENA_ROOMS.get(id).fetch(request);
  }
};

export class ArenaRoom extends DurableObject<Env> {
  private players = new Map<string, Player>();
  private items: LootItem[] = [];
  private startedAt = Date.now();
  private zoneRadius = 118;
  private zoneStage = 0;
  private ready: Promise<void>;
  private lastPersist = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ready = this.restoreState();
  }

  private async restoreState() {
    const saved = await this.ctx.storage.get<any>("arena:snapshot");
    if (saved) {
      this.items = Array.isArray(saved.items) ? saved.items : seedLoot();
      this.startedAt = Number(saved.startedAt) || Date.now();
      this.zoneRadius = Number(saved.zoneRadius) || 118;
      this.zoneStage = Number(saved.zoneStage) || 0;
      const oldPlayers = Array.isArray(saved.players) ? saved.players : [];
      const connected = new Set<string>();
      for (const socket of this.ctx.getWebSockets()) {
        try {
          const attachment = socket.deserializeAttachment() as { id?: string } | null;
          if (attachment?.id) connected.add(attachment.id);
        } catch { /* a socket with an unknown attachment is ignored */ }
      }
      for (const player of oldPlayers as Player[]) {
        if (connected.has(player.id)) this.players.set(player.id, player);
      }
    } else {
      this.items = seedLoot();
      this.startedAt = Date.now();
    }
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: null });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, rawMessage: string | ArrayBuffer) {
    await this.ready;
    if (typeof rawMessage !== "string" || rawMessage.length > 3000) {
      socket.send(JSON.stringify({ type: "error", message: "Invalid message" }));
      return;
    }
    let message: ClientMessage;
    try { message = JSON.parse(rawMessage) as ClientMessage; }
    catch {
      socket.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    const attachment = (socket.deserializeAttachment() || {}) as { id?: string };
    let player = attachment.id ? this.players.get(attachment.id) : undefined;

    if (message.type === "join") {
      if (player) {
        socket.send(JSON.stringify({ type: "welcome", id: player.id, player }));
        this.sendState();
        return;
      }
      if (this.players.size === 0) {
        this.startedAt = Date.now();
        this.zoneRadius = 118;
        this.zoneStage = 0;
        if (this.items.length < 2) this.items = seedLoot();
      }
      const id = crypto.randomUUID();
      const angle = Math.random() * Math.PI * 2;
      const radius = 12 + Math.random() * 18;
      const requestedTeam = message.team === "red" ? "red" : "blue";
      player = {
        id,
        name: cleanName(message.name),
        team: requestedTeam,
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        yaw: Math.random() * Math.PI * 2,
        hp: 100,
        alive: true,
        kills: 0,
        inventory: [
          { id: crypto.randomUUID(), kind: "rifle", name: "Assault Rifle" },
          { id: crypto.randomUUID(), kind: "medkit", name: "Medkit", amount: 1 }
        ],
        ammo: { loaded: 30, reserve: 90 },
        lastMove: Date.now(),
        lastShot: 0,
        connectedAt: Date.now()
      };
      this.players.set(id, player);
      socket.serializeAttachment({ id });
      socket.send(JSON.stringify({ type: "welcome", id, player }));
      this.broadcastEvent(player.name + " deployed");
      await this.persist();
      await this.ctx.storage.setAlarm(Date.now() + 1000);
      this.sendState();
      return;
    }

    if (!player) {
      socket.send(JSON.stringify({ type: "error", message: "Join a room before sending actions." }));
      return;
    }

    if (message.type === "team") {
      if (message.team === "red" || message.team === "blue") {
        player.team = message.team;
        this.broadcastEvent(player.name + " joined " + message.team.toUpperCase() + " squad");
      }
    } else if (message.type === "move") {
      if (!player.alive) return;
      const now = Date.now();
      const x = Number(message.x);
      const z = Number(message.z);
      if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 500 || Math.abs(z) > 500) return;
      const elapsed = Math.max(40, Math.min(400, now - player.lastMove));
      const maxStep = Math.min(3.4, 0.6 + elapsed / 1000 * (message.sprint ? 18 : 12));
      const dx = x - player.x;
      const dz = z - player.z;
      const step = Math.hypot(dx, dz);
      if (step > maxStep && step > 0) {
        player.x += dx / step * maxStep;
        player.z += dz / step * maxStep;
      } else {
        player.x = x;
        player.z = z;
      }
      const radius = Math.hypot(player.x, player.z);
      if (radius > 115) {
        player.x *= 115 / radius;
        player.z *= 115 / radius;
      }
      if (Number.isFinite(Number(message.yaw))) player.yaw = Number(message.yaw);
      player.lastMove = now;
      this.sendState();
      if (now - this.lastPersist > 1000) await this.persist();
    } else if (message.type === "shoot") {
      if (!player.alive) return;
      const now = Date.now();
      const weapon = player.inventory[Math.max(0, Math.min(player.inventory.length - 1, Number(message.weaponIndex) || 0))];
      if (weapon?.kind === "medkit") {
        socket.send(JSON.stringify({ type: "error", message: "Select a weapon slot to fire." }));
        return;
      }
      const fireDelay = weapon?.kind === "shotgun" ? 700 : 260;
      if (now - player.lastShot < fireDelay) return;
      player.lastShot = now;
      if (player.ammo.loaded <= 0) {
        socket.send(JSON.stringify({ type: "error", message: "Magazine empty — press R to reload." }));
        return;
      }
      player.ammo.loaded -= 1;
      const target = message.targetId ? this.players.get(message.targetId) : undefined;
      if (target && target.id !== player.id && target.alive && target.team !== player.team && distance(player, target) < 90) {
        target.hp = Math.max(0, target.hp - (weapon?.kind === "shotgun" ? 48 : 34));
        this.broadcastEvent(player.name + " hit " + target.name + " (" + target.hp + " HP)");
        if (target.hp === 0) {
          target.alive = false;
          player.kills += 1;
          this.broadcastEvent(target.name + " was eliminated by " + player.name);
        }
      }
      this.sendState();
      await this.persist();
    } else if (message.type === "pickup") {
      if (!player.alive) return;
      const index = this.items.findIndex((item) => item.id === message.itemId);
      const item = this.items[index];
      if (!item || distance(player, item) > 5.8) {
        socket.send(JSON.stringify({ type: "error", message: "Move closer to that item." }));
        return;
      }
      if (item.kind === "ammo") {
        player.ammo.reserve = Math.min(240, player.ammo.reserve + item.amount);
      } else if (item.kind === "medkit") {
        const existing = player.inventory.find((entry) => entry.kind === "medkit");
        if (existing) existing.amount = Math.min(5, (existing.amount || 1) + 1);
        else player.inventory.push({ id: crypto.randomUUID(), kind: "medkit", name: "Medkit", amount: 1 });
      } else if (!player.inventory.some((entry) => entry.kind === item.kind)) {
        player.inventory.push({ id: crypto.randomUUID(), kind: item.kind, name: item.name });
      } else {
        socket.send(JSON.stringify({ type: "error", message: "You already carry that weapon." }));
        return;
      }
      this.items.splice(index, 1);
      this.broadcastEvent(player.name + " picked up " + item.name);
      await this.persist();
      this.sendState();
    } else if (message.type === "drop") {
      const index = player.inventory.findIndex((entry) => entry.id === message.itemId);
      if (index < 0) return;
      const [entry] = player.inventory.splice(index, 1);
      this.items.push({
        id: crypto.randomUUID(),
        kind: entry.kind,
        name: entry.name,
        x: player.x + (Math.random() - 0.5) * 1.3,
        z: player.z + (Math.random() - 0.5) * 1.3,
        amount: entry.amount || 1
      });
      this.broadcastEvent(player.name + " dropped " + entry.name);
      await this.persist();
      this.sendState();
    } else if (message.type === "reload") {
      if (player.ammo.loaded < 30 && player.ammo.reserve > 0) {
        const load = Math.min(30 - player.ammo.loaded, player.ammo.reserve);
        player.ammo.loaded += load;
        player.ammo.reserve -= load;
        this.broadcastEvent(player.name + " reloaded");
        this.sendState();
      }
    } else if (message.type === "use") {
      const index = player.inventory.findIndex((entry) => entry.id === message.itemId && entry.kind === "medkit");
      if (index < 0 || player.hp >= 100) {
        socket.send(JSON.stringify({ type: "error", message: player.hp >= 100 ? "Health is already full." : "No medkit available." }));
        return;
      }
      player.hp = Math.min(100, player.hp + 55);
      const kit = player.inventory[index];
      kit.amount = (kit.amount || 1) - 1;
      if (kit.amount <= 0) player.inventory.splice(index, 1);
      this.broadcastEvent(player.name + " used a medkit");
      await this.persist();
      this.sendState();
    }
  }

  async webSocketClose(socket: WebSocket) {
    await this.ready;
    const attachment = (socket.deserializeAttachment() || {}) as { id?: string };
    const player = attachment.id ? this.players.get(attachment.id) : undefined;
    if (player) {
      this.players.delete(player.id);
      this.broadcastEvent(player.name + " left the match");
      await this.persist();
      this.sendState();
    }
    if (this.ctx.getWebSockets().length === 0) {
      await this.ctx.storage.deleteAlarm();
    }
  }

  async webSocketError(socket: WebSocket) {
    await this.webSocketClose(socket);
  }

  async alarm() {
    await this.ready;
    if (this.ctx.getWebSockets().length === 0) return;
    const now = Date.now();
    const progress = Math.min(1, (now - this.startedAt) / (8 * 60 * 1000));
    this.zoneRadius = 118 - progress * 94;
    this.zoneStage = Math.min(5, Math.floor(progress * 6));
    for (const player of this.players.values()) {
      if (player.alive && Math.hypot(player.x, player.z) > this.zoneRadius) {
        player.hp = Math.max(0, player.hp - 4);
        if (player.hp === 0) {
          player.alive = false;
          this.broadcastEvent(player.name + " was lost to the zone");
        }
      }
    }
    this.sendState();
    await this.persist();
    await this.ctx.storage.setAlarm(Date.now() + 1000);
  }

  private async persist() {
    this.lastPersist = Date.now();
    await this.ctx.storage.put("arena:snapshot", {
      players: Array.from(this.players.values()),
      items: this.items,
      startedAt: this.startedAt,
      zoneRadius: this.zoneRadius,
      zoneStage: this.zoneStage
    });
  }

  private sendState() {
    const players = Array.from(this.players.values()).map((player) => ({
      id: player.id,
      name: player.name,
      team: player.team,
      x: player.x,
      z: player.z,
      yaw: player.yaw,
      hp: player.hp,
      alive: player.alive,
      kills: player.kills,
      inventory: player.inventory,
      ammo: player.ammo
    }));
    const items = this.items;
    for (const socket of this.ctx.getWebSockets()) {
      try {
        const attachment = (socket.deserializeAttachment() || {}) as { id?: string };
        socket.send(JSON.stringify({
          type: "state",
          you: attachment.id || null,
          players,
          items,
          zone: { radius: this.zoneRadius, stage: this.zoneStage }
        }));
      } catch { /* A closing socket can fail to receive a snapshot. */ }
    }
  }

  private broadcastEvent(text: string) {
    const payload = JSON.stringify({ type: "event", text: String(text).slice(0, 120) });
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.send(payload); } catch { /* Ignore sockets that are closing. */ }
    }
  }
}
