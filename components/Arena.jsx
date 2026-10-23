"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL || "ws://localhost:8787";
const COLORS = { blue: 0x4ca6ff, red: 0xff615c, neutral: 0xd7e4ee };
const shortId = () => Math.random().toString(36).slice(2, 9);

function makeAvatar(color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.42, 0.85, 4, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.76 })
  );
  body.position.y = 1.05;
  body.castShadow = true;
  body.userData.hitPart = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0xd2a17c, roughness: 0.92 })
  );
  head.position.y = 1.78;
  head.castShadow = true;
  head.userData.hitPart = true;
  group.add(head);
  const pack = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.55, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x344452 })
  );
  pack.position.set(0, 1.1, 0.42);
  group.add(pack);
  return group;
}

function makeLootMesh(kind) {
  const color = kind === "medkit" ? 0x4fe08b : kind === "ammo" ? 0xffce54 : kind === "shotgun" ? 0xf79a55 : 0x6bd4ff;
  const geometry = kind === "medkit"
    ? new THREE.BoxGeometry(0.65, 0.42, 0.46)
    : new THREE.BoxGeometry(0.7, 0.24, 0.28);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.15, roughness: 0.45 }));
  mesh.position.y = 0.45;
  mesh.castShadow = true;
  return mesh;
}

function buildIsland(scene) {
  scene.background = new THREE.Color(0x97c7d4);
  scene.fog = new THREE.Fog(0x97c7d4, 130, 360);
  const hemi = new THREE.HemisphereLight(0xdaf4ff, 0x4c664b, 2.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 3.2);
  sun.position.set(-45, 85, 35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -150;
  sun.shadow.camera.right = 150;
  sun.shadow.camera.top = 150;
  sun.shadow.camera.bottom = -150;
  scene.add(sun);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ color: 0x3189a7, roughness: 0.28, metalness: 0.12 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -3.4;
  scene.add(water);

  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(118, 128, 5, 96),
    new THREE.MeshStandardMaterial({ color: 0x71965c, roughness: 1 })
  );
  island.position.y = -1.2;
  island.receiveShadow = true;
  island.castShadow = true;
  scene.add(island);

  const meadow = new THREE.Mesh(
    new THREE.CircleGeometry(117.7, 96),
    new THREE.MeshStandardMaterial({ color: 0x82a963, roughness: 1 })
  );
  meadow.rotation.x = -Math.PI / 2;
  meadow.position.y = 1.33;
  meadow.receiveShadow = true;
  scene.add(meadow);

  // Original low-poly buildings and trees provide sightlines and cover.
  const houseMaterial = new THREE.MeshStandardMaterial({ color: 0xc9b89b, roughness: 0.9 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x785e4b, roughness: 1 });
  const housePlaces = [[-24, -18], [-46, 20], [36, 18], [18, 48], [52, -34], [-8, 56], [-60, -24]];
  housePlaces.forEach(([x, z], index) => {
    const house = new THREE.Group();
    const width = index % 2 ? 9 : 11;
    const depth = index % 3 ? 8 : 10;
    const walls = new THREE.Mesh(new THREE.BoxGeometry(width, 5, depth), houseMaterial);
    walls.position.y = 3.8;
    walls.castShadow = true;
    walls.receiveShadow = true;
    house.add(walls);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(width * 0.78, 3.5, 4), roofMaterial);
    roof.position.y = 8.05;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    house.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.45, 2.6, 0.2), new THREE.MeshStandardMaterial({ color: 0x5c4538 }));
    door.position.set(0, 2.5, depth / 2 + 0.12);
    house.add(door);
    house.position.set(x, 0, z);
    scene.add(house);
  });

  for (let i = 0; i < 72; i++) {
    const angle = i * 2.399;
    const radius = 18 + (i % 13) * 6.6;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (housePlaces.some(([hx, hz]) => Math.abs(hx - x) < 10 && Math.abs(hz - z) < 9)) continue;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.4, 2.1, 6),
      new THREE.MeshStandardMaterial({ color: 0x68503a })
    );
    trunk.position.y = 1;
    trunk.castShadow = true;
    tree.add(trunk);
    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(1.55 + (i % 3) * 0.18, 4.2 + (i % 4) * 0.25, 7),
      new THREE.MeshStandardMaterial({ color: i % 3 === 0 ? 0x3e7446 : 0x527f4a, roughness: 1 })
    );
    leaves.position.y = 3.55;
    leaves.castShadow = true;
    tree.add(leaves);
    tree.position.set(x, 0, z);
    tree.rotation.y = i * 0.71;
    scene.add(tree);
  }

  for (let i = 0; i < 22; i++) {
    const angle = i * Math.PI * 2 / 22;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1 + (i % 4) * 0.3, 0),
      new THREE.MeshStandardMaterial({ color: 0x6c796b, roughness: 1 })
    );
    rock.position.set(Math.cos(angle) * (96 + (i % 3) * 3), 0.75, Math.sin(angle) * (96 + (i % 3) * 3));
    rock.scale.y = 0.8;
    rock.castShadow = true;
    scene.add(rock);
  }
}

export default function Arena() {
  const mountRef = useRef(null);
  const gameRef = useRef(null);
  const socketRef = useRef(null);
  const actionsRef = useRef({});
  const selfIdRef = useRef("");
  const selectedRef = useRef(0);
  const [connection, setConnection] = useState("connecting");
  const [room, setRoom] = useState("public");
  const [name, setName] = useState("Ranger-" + shortId());
  const [selfId, setSelfId] = useState("");
  const [players, setPlayers] = useState([]);
  const [items, setItems] = useState([]);
  const [hp, setHp] = useState(100);
  const [ammo, setAmmo] = useState({ loaded: 30, reserve: 90 });
  const [inventory, setInventory] = useState([]);
  const [team, setTeam] = useState("blue");
  const [feed, setFeed] = useState(["Find gear, team up, and survive the zone."]);
  const [zone, setZone] = useState({ radius: 112, stage: 0 });
  const [kills, setKills] = useState(0);
  const [selected, setSelected] = useState(0);

  const logEvent = (message) => {
    setFeed((old) => [String(message).slice(0, 100), ...old].slice(0, 5));
  };

  actionsRef.current = {
    setSelfId,
    setPlayers,
    setItems,
    setHp,
    setInventory,
    setTeam,
    setAmmo,
    setZone,
    setKills,
    logEvent,
    getName: () => name
  };
  selfIdRef.current = selfId;
  selectedRef.current = selected;
  actionsRef.current.selfId = selfId;

  function joinRoom() {
    if (socketRef.current && socketRef.current.readyState <= WebSocket.OPEN) return;
    const safeRoom = room.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24) || "public";
    const address = SERVER_URL.replace(/\/$/, "") + "/room/" + safeRoom;
    setConnection("connecting");
    try {
      const socket = new WebSocket(address);
      socketRef.current = socket;
      socket.onopen = () => {
        setConnection("online");
        socket.send(JSON.stringify({ type: "join", name: name.trim().slice(0, 24) || "Ranger", team }));
      };
      socket.onmessage = (event) => {
        let data;
        try { data = JSON.parse(event.data); } catch { return; }
        const a = actionsRef.current;
        if (data.type === "welcome") {
          selfIdRef.current = data.id;
          a.setSelfId(data.id);
          if (data.player && gameRef.current?.localPosition &&
              Number.isFinite(data.player.x) && Number.isFinite(data.player.z)) {
            gameRef.current.localPosition.x = data.player.x;
            gameRef.current.localPosition.z = data.player.z;
          }
          if (data.player) {
            a.setHp(data.player.hp || 100);
            a.setInventory(data.player.inventory || []);
            a.setTeam(data.player.team || "blue");
          }
          a.logEvent("Connected to room " + safeRoom);
        } else if (data.type === "state") {
          a.setPlayers(data.players || []);
          a.setItems(data.items || []);
          if (data.zone) a.setZone(data.zone);
          const mine = (data.players || []).find((player) => player.id === data.you);
          if (mine) {
            a.setHp(mine.hp);
            a.setInventory(mine.inventory || []);
            a.setTeam(mine.team);
            a.setAmmo(mine.ammo || { loaded: 30, reserve: 90 });
            a.setKills(mine.kills || 0);
          }
        } else if (data.type === "event") {
          a.logEvent(data.text);
        } else if (data.type === "error") {
          a.logEvent(data.message || "Game server rejected an action");
        }
      };
      socket.onclose = () => {
        setConnection("offline");
        setSelfId("");
      };
      socket.onerror = () => setConnection("offline");
    } catch {
      setConnection("offline");
    }
  }

  function send(action) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      logEvent("Connect to a room first.");
      return;
    }
    socket.send(JSON.stringify(action));
  }

  actionsRef.current.send = send;

  useEffect(() => {
    if (!mountRef.current) return undefined;
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    buildIsland(scene);
    const camera = new THREE.PerspectiveCamera(68, mount.clientWidth / mount.clientHeight, 0.1, 650);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const playerMeshes = new Map();
    const lootMeshes = new Map();
    const playerTargetMeshes = [];
    const zoneMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.985, 1, 128),
      new THREE.MeshBasicMaterial({ color: 0x5ee3ff, side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false })
    );
    zoneMesh.rotation.x = -Math.PI / 2;
    zoneMesh.position.y = 1.42;
    scene.add(zoneMesh);

    const localPosition = { x: 0, z: 0 };
    const pressed = new Set();
    let yaw = 0;
    let pitch = -0.16;
    let lastSent = 0;
    let lastTime = performance.now();
    let lastPickup = 0;
    let raf = 0;
    const raycaster = new THREE.Raycaster();
    const forward = new THREE.Vector3();
    const target = new THREE.Vector3();

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const onCanvasClick = (event) => {
      if (event.button !== 0) return;
      if (document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock?.();
        return;
      }
      forward.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).normalize();
      raycaster.set(camera.position, forward);
      const hits = raycaster.intersectObjects(playerTargetMeshes, true);
      const victim = hits.find((hit) => hit.object.userData.playerId && hit.object.userData.playerId !== actionsRef.current.selfId);
      const selectedItem = (gameRef.current?.inventory || [])[selectedRef.current];
      if (selectedItem?.kind === "medkit") actionsRef.current.send?.({ type: "use", itemId: selectedItem.id });
      else actionsRef.current.send?.({ type: "shoot", targetId: victim?.object.userData.playerId || null, weaponIndex: selectedRef.current });
    };

    const onMouseMove = (event) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      yaw -= event.movementX * 0.0022;
      pitch = THREE.MathUtils.clamp(pitch - event.movementY * 0.0018, -0.8, 0.32);
    };

    const onKeyDown = (event) => {
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight"].includes(event.code)) {
        pressed.add(event.code);
        event.preventDefault();
      }
      if (event.repeat) return;
      if (event.code === "KeyE") {
        const currentItems = gameRef.current?.items || [];
        const closest = currentItems.map((item) => ({ item, distance: Math.hypot(item.x - localPosition.x, item.z - localPosition.z) })).sort((a, b) => a.distance - b.distance)[0];
        if (closest && closest.distance < 5.5) actionsRef.current.send?.({ type: "pickup", itemId: closest.item.id });
        else actionsRef.current.logEvent?.("No loot nearby.");
      }
      if (event.code === "KeyG") {
        const inv = gameRef.current?.inventory || [];
        const item = inv[Math.min(selectedRef.current, Math.max(0, inv.length - 1))];
        if (item) actionsRef.current.send?.({ type: "drop", itemId: item.id });
      }
      if (event.code === "KeyR") actionsRef.current.send?.({ type: "reload" });
      if (event.code === "Digit1") setSelected(0);
      if (event.code === "Digit2") setSelected(1);
    };
    const onKeyUp = (event) => pressed.delete(event.code);
    renderer.domElement.addEventListener("click", onCanvasClick);
    document.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("resize", resize);

    const animate = (now) => {
      raf = requestAnimationFrame(animate);
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const speed = pressed.has("ShiftLeft") || pressed.has("ShiftRight") ? 13.4 : 8.2;
      let f = (pressed.has("KeyW") ? 1 : 0) - (pressed.has("KeyS") ? 1 : 0);
      let s = (pressed.has("KeyD") ? 1 : 0) - (pressed.has("KeyA") ? 1 : 0);
      const length = Math.hypot(f, s) || 1;
      f /= length; s /= length;
      localPosition.x += (Math.sin(yaw) * f + Math.cos(yaw) * s) * speed * delta;
      localPosition.z += (-Math.cos(yaw) * f + Math.sin(yaw) * s) * speed * delta;
      const radius = Math.hypot(localPosition.x, localPosition.z);
      if (radius > 113) {
        localPosition.x *= 113 / radius;
        localPosition.z *= 113 / radius;
      }

      const snapshots = gameRef.current?.players || [];
      playerTargetMeshes.length = 0;
      snapshots.forEach((player) => {
        let group = playerMeshes.get(player.id);
        if (!group) {
          group = makeAvatar(COLORS[player.team] || COLORS.neutral);
          group.traverse((node) => {
            if (node.isMesh && node.userData.hitPart) {
              node.userData.playerId = player.id;
              node.material = node.material.clone();
              if (player.id === selfIdRef.current) node.material.emissive = new THREE.Color(0x244444);
              playerTargetMeshes.push(node);
            }
          });
          playerMeshes.set(player.id, group);
          scene.add(group);
        } else {
          group.traverse((node) => {
            if (node.isMesh && node.userData.hitPart) playerTargetMeshes.push(node);
          });
        }
        const x = player.id === selfIdRef.current ? localPosition.x : player.x;
        const z = player.id === selfIdRef.current ? localPosition.z : player.z;
        group.position.lerp(new THREE.Vector3(x, player.alive ? 0 : -8, z), player.id === selfIdRef.current ? 1 : 0.36);
        group.rotation.y = player.id === selfIdRef.current ? yaw : (player.yaw || 0);
        group.visible = player.alive !== false;
        group.traverse((node) => {
          if (node.isMesh && node.userData.hitPart) node.userData.playerId = player.id;
        });
      });

      const knownPlayers = new Set(snapshots.map((player) => player.id));
      for (const [id, group] of playerMeshes.entries()) {
        if (!knownPlayers.has(id)) {
          scene.remove(group);
          playerMeshes.delete(id);
        }
      }

      const snapshotItems = gameRef.current?.items || [];
      const knownItems = new Set(snapshotItems.map((item) => item.id));
      snapshotItems.forEach((item) => {
        let mesh = lootMeshes.get(item.id);
        if (!mesh) {
          mesh = makeLootMesh(item.kind);
          lootMeshes.set(item.id, mesh);
          scene.add(mesh);
        }
        mesh.position.set(item.x, 0.6 + Math.sin(now / 420 + item.x) * 0.14, item.z);
        mesh.rotation.y += delta * 0.8;
      });
      for (const [id, mesh] of lootMeshes.entries()) {
        if (!knownItems.has(id)) {
          scene.remove(mesh);
          lootMeshes.delete(id);
        }
      }

      const safe = gameRef.current?.zone || { radius: 112 };
      zoneMesh.scale.setScalar(Math.max(1, safe.radius || 112));
      zoneMesh.position.y = 1.44;
      target.set(localPosition.x, 1.2, localPosition.z);
      const cameraDistance = 7.8;
      camera.position.set(
        localPosition.x - Math.sin(yaw) * cameraDistance * Math.cos(pitch),
        3.2 + Math.sin(-pitch) * 4.2,
        localPosition.z + Math.cos(yaw) * cameraDistance * Math.cos(pitch)
      );
      camera.lookAt(target);
      if (now - lastSent > 65 && socketRef.current?.readyState === WebSocket.OPEN && selfIdRef.current) {
        actionsRef.current.send?.({ type: "move", x: localPosition.x, z: localPosition.z, yaw, sprint: speed > 10 });
        lastSent = now;
      }
      renderer.render(scene, camera);
    };

    gameRef.current = { scene, camera, renderer, playerMeshes, lootMeshes, localPosition, players, items, inventory, zone };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener("click", onCanvasClick);
      document.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", resize);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      renderer.dispose();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (gameRef.current) {
      gameRef.current.players = players;
      gameRef.current.items = items;
      gameRef.current.inventory = inventory;
      gameRef.current.zone = zone;
    }
  }, [players, items, inventory, zone]);

  useEffect(() => {
    joinRoom();
    return () => {
      socketRef.current?.close();
    };
    // Connect once on mount; the room is chosen on the first screen load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nearestItem = items.map((item) => ({ ...item, distance: Math.hypot((item.x || 0) - (gameRef.current?.localPosition.x || 0), (item.z || 0) - (gameRef.current?.localPosition.z || 0)) }))
    .sort((a, b) => a.distance - b.distance)[0];

  return (
    <main className="arena-shell">
      <div ref={mountRef} className="world-canvas" aria-label="3D Island Arena game world" />
      <div className="top-brand">
        <div className="brand-mark">IA</div>
        <div><strong>ISLAND ARENA</strong><span>LAST SQUAD STANDING</span></div>
      </div>

      <section className="room-panel glass-panel">
        <div className="panel-kicker"><span className={"status-dot " + connection}></span>{connection === "online" ? "MATCH CONNECTION LIVE" : connection === "connecting" ? "CONNECTING TO REALTIME" : "SERVER DISCONNECTED"}</div>
        <div className="room-form">
          <input value={name} onChange={(event) => setName(event.target.value.slice(0, 24))} aria-label="Player nickname" maxLength={24} />
          <div className="room-code-row">
            <input value={room} onChange={(event) => setRoom(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24))} aria-label="Room code" maxLength={24} />
            <button onClick={() => { socketRef.current?.close(); setTimeout(joinRoom, 120); }} className="join-button">{connection === "online" ? "REJOIN" : "JOIN MATCH"}</button>
          </div>
        </div>
        <div className="team-pick">
          <button className={team === "blue" ? "team-chip blue active" : "team-chip blue"} onClick={() => { setTeam("blue"); send({ type: "team", team: "blue" }); }}>BLUE SQUAD</button>
          <button className={team === "red" ? "team-chip red active" : "team-chip red"} onClick={() => { setTeam("red"); send({ type: "team", team: "red" }); }}>RED SQUAD</button>
        </div>
      </section>

      <section className="status-panel glass-panel">
        <div className="status-title">SURVIVAL STATUS</div>
        <div className="health-line"><span>HEALTH</span><strong>{Math.max(0, hp)}%</strong></div>
        <div className="health-track"><div className="health-fill" style={{ width: Math.max(0, Math.min(100, hp)) + "%" }} /></div>
        <div className="mini-stats">
          <div><span>ELIMS</span><strong>{kills}</strong></div>
          <div><span>ALIVE</span><strong>{players.filter((player) => player.alive !== false).length}</strong></div>
          <div><span>ZONE</span><strong>{Math.round(zone.radius || 0)}m</strong></div>
        </div>
      </section>

      <section className="squad-panel glass-panel">
        <div className="panel-heading"><span>SQUAD INTEL</span><span>{players.length} CONNECTED</span></div>
        <div className="player-list">
          {players.slice(0, 5).map((player) => (
            <div className="player-row" key={player.id}>
              <span className={"player-color " + player.team}></span>
              <div className="player-details"><strong>{player.name}{player.id === selfId ? " (YOU)" : ""}</strong><span>{player.alive === false ? "ELIMINATED" : (player.team || "blue").toUpperCase() + " SQUAD"}</span></div>
              <strong className="player-hp">{Math.max(0, player.hp || 0)}</strong>
            </div>
          ))}
          {!players.length && <div className="empty-row">Waiting for players to join the room…</div>}
        </div>
      </section>

      <section className="loot-panel glass-panel">
        <div className="panel-heading"><span>LOADOUT</span><span>1 / 2</span></div>
        <div className="loadout-slots">
          {[0, 1].map((index) => {
            const item = inventory[index];
            return <button key={index} className={"loadout-slot " + (selected === index ? "selected" : "")} onClick={() => setSelected(index)}>
              <span className="slot-num">{index + 1}</span>
              <span className={"slot-icon " + (item?.kind || "empty")}>{item?.kind === "medkit" ? "✚" : item?.kind === "shotgun" ? "╱" : item ? "⌁" : "—"}</span>
              <span className="slot-name">{item?.name || item?.kind || "EMPTY SLOT"}</span>
            </button>;
          })}
        </div>
        <div className="ammo-line"><span>AMMO</span><strong>{ammo.loaded ?? 30}<i> / {ammo.reserve ?? 90}</i></strong></div>
        <div className="loot-nearby">{nearestItem && nearestItem.distance < 5.5 ? "E  PICK UP " + String(nearestItem.kind).toUpperCase() : "E  PICK UP NEARBY LOOT"} <span>·</span> G DROP</div>
      </section>

      <section className="feed-panel">
        {feed.map((message, index) => <div className="feed-entry" key={message + index}>{message}</div>)}
      </section>

      <div className="zone-warning"><span className="warning-icon">!</span><div><strong>SAFE ZONE</strong><span>{zone.stage ? "ZONE IS CLOSING — MOVE IN" : "Stay inside the blue boundary"}</span></div></div>
      <div className="center-crosshair"><span></span><i></i><span></span><b></b></div>

      <div className="bottom-controls">
        <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>MOVE</span></div>
        <div><kbd>SHIFT</kbd><span>SPRINT</span></div>
        <div><kbd>CLICK</kbd><span>AIM / FIRE</span></div>
        <div><kbd>E</kbd><span>LOOT</span></div>
        <div><kbd>R</kbd><span>RELOAD</span></div>
      </div>
      <div className="reticle-hint">{connection === "online" ? "CLICK WORLD TO CAPTURE MOUSE" : "START YOUR MATCH TO PLAY ONLINE"}</div>
    </main>
  );
}
