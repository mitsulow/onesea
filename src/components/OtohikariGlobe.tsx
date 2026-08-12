"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { COASTLINES } from "@/lib/coastlines";

/**
 * OTOHIKARI 地球儀 — schumann/globe.html（過去作）から移植した本番ビジュアル。
 * - 雷ホタル: Blitzortung.org の世界の雷リアルタイム観測（シューマン共振の源）
 * - 電離層グリッド共振: 約3秒ごとに球全体が波のように光る
 * - 夜の街明かり・大気グロー・流星
 * - 水色のホタル: いまシューマン音©を聴いている人の場所（点呼の実データ）
 * - 雷は黄色、聴いている人は水色で色分け
 */
export type MapMode = "otohikari" | "thunder" | "all";

export function OtohikariGlobe({
  spots,
  mode = "all",
  connected = false,
}: {
  spots: Array<[number, number, number] | null>;
  mode?: MapMode;
  connected?: boolean;
}) {
  const modeRef = useRef<MapMode>(mode);
  modeRef.current = mode;
  const connectedRef = useRef(connected);
  connectedRef.current = connected;
  const hostRef = useRef<HTMLDivElement>(null);
  const spotsRef = useRef(spots);
  const spotsDirtyRef = useRef(true); // 変わった時だけ光柱を組み直す(毎フレームのstringify比較をやめた)
  if (spotsRef.current !== spots) {
    spotsRef.current = spots;
    spotsDirtyRef.current = true;
  }

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const W = host.clientWidth;
    const H = 360;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
    camera.position.set(0, 0, 2.85);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "pan-y";

    /* ── 地球 ── */
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x070c1a })
    );
    scene.add(earth);
    earth.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(1.001, 36, 18),
        new THREE.MeshBasicMaterial({ color: 0x14305a, wireframe: true, transparent: true, opacity: 0.05 })
      )
    );

    // 夜の街明かり（ロード失敗しても海岸線があるので問題なし）
    new THREE.TextureLoader().load(
      "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/textures/planets/earth_lights_2048.png",
      (tex) => {
        earth.add(
          new THREE.Mesh(
            new THREE.SphereGeometry(1.0008, 64, 64),
            new THREE.MeshBasicMaterial({
              map: tex,
              color: 0xffc878,
              transparent: true,
              opacity: 0.85,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            })
          )
        );
      }
    );

    const ll2v = (lat: number, lng: number, r: number) => {
      const phi = ((90 - lat) * Math.PI) / 180;
      const theta = ((lng + 180) * Math.PI) / 180;
      return new THREE.Vector3(
        -r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
    };

    // 簡易海岸線（即表示。詳細版ロード後に置換）
    const roughGroup = new THREE.Group();
    const landMat = new THREE.MeshBasicMaterial({ color: 0x0a1c18, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    for (const poly of COASTLINES) {
      if (poly.length < 3) continue;
      const verts = poly.map((p) => ll2v(p[0], p[1], 1.0015));
      const center = new THREE.Vector3();
      verts.forEach((v) => center.add(v));
      center.divideScalar(verts.length).normalize().multiplyScalar(1.0015);
      const pos: number[] = [];
      for (let i = 0; i < verts.length; i++) {
        const nx = verts[(i + 1) % verts.length];
        pos.push(center.x, center.y, center.z, verts[i].x, verts[i].y, verts[i].z, nx.x, nx.y, nx.z);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      roughGroup.add(new THREE.Mesh(g, landMat));
    }
    const cMat = new THREE.LineBasicMaterial({ color: 0x2aa88c, transparent: true, opacity: 0.55 });
    {
      // Safari対策: 線を1本ずつ別オブジェクトにするとドローコールが増えて重い。
      // 全ての折れ線を「線分ペアの1バッファ」にまとめ、描画命令を1回にする。
      const cPos: number[] = [];
      for (const line of COASTLINES) {
        const pts = line.map((p) => ll2v(p[0], p[1], 1.003));
        for (let i = 0; i < pts.length - 1; i++) {
          cPos.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
        }
      }
      const cG = new THREE.BufferGeometry();
      cG.setAttribute("position", new THREE.Float32BufferAttribute(cPos, 3));
      roughGroup.add(new THREE.LineSegments(cG, cMat));
    }
    earth.add(roughGroup);

    // 詳細海岸線の二段構え: まず50m(約0.6MB)で即精細化 → 裏で最高解像度10m(約3MB)を
    // 読んで差し替え。初回表示の速さと稜線の細かさ(石垣島どころか竹富・西表の輪郭まで)を両取り。
    let disposed = false;
    (async () => {
      try {
        const { feature } = await import("topojson-client");
        const dMat = new THREE.LineBasicMaterial({ color: 0x35e0b8, transparent: true, opacity: 0.9 });
        // Safariの重さの主犯対策: リング(数千本)ごとにLineLoopを作ると
        // 毎フレーム数千回の描画命令になりWebKitで激重。
        // 全リングを「線分ペアの1バッファ」に統合し、命令1回で全海岸線を描く。
        // 10m化で頂点は増えるが描画命令は1回のままなので前回の激重は再発しない。
        // ※リングの閉じ線分(終点→始点)も明示的に入れるので、島どうしが誤って繋がることはない。
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const buildLand = (topo: any): THREE.LineSegments => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const land = feature(topo, topo.objects.land) as any;
          const features = land.type === "FeatureCollection" ? land.features : [land];
          const segPos: number[] = [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          features.forEach((f: any) => {
            const geom = f.geometry;
            const rings: Array<Array<[number, number]>> =
              geom.type === "Polygon" ? geom.coordinates : geom.coordinates.flat();
            rings.forEach((ring) => {
              if (ring.length < 3) return;
              const pts = ring.map((c) => ll2v(c[1], c[0], 1.004));
              for (let i = 0; i < pts.length; i++) {
                const a = pts[i];
                const b = pts[(i + 1) % pts.length];
                segPos.push(a.x, a.y, a.z, b.x, b.y, b.z);
              }
            });
          });
          const segG = new THREE.BufferGeometry();
          segG.setAttribute("position", new THREE.Float32BufferAttribute(segPos, 3));
          return new THREE.LineSegments(segG, dMat);
        };
        let cur: THREE.LineSegments | null = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const swapTo = (topo: any) => {
          if (disposed) return;
          const seg = buildLand(topo);
          earth.add(seg);
          if (cur) {
            earth.remove(cur);
            cur.geometry.dispose();
          } else {
            earth.remove(roughGroup);
          }
          cur = seg;
        };
        const r50 = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json");
        if (!r50.ok || disposed) return;
        swapTo(await r50.json());
        // 比較テスト: ?coast=50m を付けると10mへの差し替えをスキップ(前回密度のまま)
        if (new URLSearchParams(window.location.search).get("coast") === "50m") return;
        const r10 = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/land-10m.json");
        if (!r10.ok || disposed) return;
        swapTo(await r10.json());
      } catch {
        /* オフライン等 → その時点の海岸線のまま */
      }
    })();

    // 大気グロー
    scene.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(1.07, 64, 64),
        new THREE.ShaderMaterial({
          vertexShader:
            "varying vec3 vN,vP;void main(){vN=normalize(normalMatrix*normal);vP=(modelViewMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
          fragmentShader:
            "varying vec3 vN,vP;void main(){float f=1.0-max(dot(vN,normalize(-vP)),0.0);f=pow(f,3.2);gl_FragColor=vec4(0.2,0.5,1.0,f*0.5);}",
          transparent: true,
          side: THREE.FrontSide,
          depthWrite: false,
        })
      )
    );

    /* ── 雷ホタル（Blitzortung.org リアルタイム） ── */
    const MAX_PTS = 1500;
    const STRIKE_LIFE = 22.0;
    const fPos = new Float32Array(MAX_PTS * 3);
    const fSz = new Float32Array(MAX_PTS);
    const fPh = new Float32Array(MAX_PTS);
    const fIn = new Float32Array(MAX_PTS);
    const fBorn = new Float32Array(MAX_PTS);
    fBorn.fill(-99999);
    const fG = new THREE.BufferGeometry();
    fG.setAttribute("position", new THREE.BufferAttribute(fPos, 3));
    fG.setAttribute("aSize", new THREE.BufferAttribute(fSz, 1));
    fG.setAttribute("aPhase", new THREE.BufferAttribute(fPh, 1));
    fG.setAttribute("aInt", new THREE.BufferAttribute(fIn, 1));
    fG.setAttribute("aBorn", new THREE.BufferAttribute(fBorn, 1));
    fG.setDrawRange(0, MAX_PTS);
    const ffMat = new THREE.ShaderMaterial({
      vertexShader: `attribute float aSize,aPhase,aInt,aBorn;varying float vPh,vIn,vBorn;uniform float uTime;
      void main(){vPh=aPhase;vIn=aInt;vBorn=aBorn;vec4 mv=modelViewMatrix*vec4(position,1.0);
      float age=uTime-aBorn;float flash=1.0+1.6*exp(-age*4.0);
      gl_PointSize=aSize*(80.0/-mv.z)*flash;gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform float uTime,uLife;varying float vPh,vIn,vBorn;
      void main(){float d=length(gl_PointCoord-0.5);if(d>0.5)discard;
      float age=uTime-vBorn;
      float ain=clamp(age/0.15,0.0,1.0);
      float aout=clamp(1.0-age/uLife,0.0,1.0);
      float flash=1.0+2.2*exp(-age*5.0);
      float pulse=sin(uTime*1.4+vPh)*0.25+0.75;
      float alpha=smoothstep(0.5,0.05,d);float core=smoothstep(0.22,0.0,d);
      float b=alpha*pulse*vIn*0.62*ain*aout*flash;
      if(b<0.004)discard;
      vec3 col=mix(vec3(1.0,0.82,0.28),vec3(1.0,1.0,0.9),core);
      gl_FragColor=vec4(col*b,b);}`,
      uniforms: { uTime: { value: 0 }, uLife: { value: STRIKE_LIFE } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const strikePoints = new THREE.Points(fG, ffMat);
    earth.add(strikePoints);

    const clock = new THREE.Clock();
    let strikeIdx = 0;
    let strikesDirty = false;
    const addStrike = (lat: number, lon: number, t: number) => {
      const i = strikeIdx;
      strikeIdx = (strikeIdx + 1) % MAX_PTS;
      const v = ll2v(lat, lon, 1.015);
      fPos[i * 3] = v.x;
      fPos[i * 3 + 1] = v.y;
      fPos[i * 3 + 2] = v.z;
      fSz[i] = 1.6 + Math.random() * 1.9;
      fPh[i] = Math.random() * Math.PI * 2;
      fIn[i] = 0.55 + Math.random() * 0.45;
      fBorn[i] = t;
      strikesDirty = true;
    };

    const lzwDecode = (data: string): string => {
      const dict: Record<number, string> = {};
      let currChar = data[0];
      let oldPhrase = currChar;
      const out = [currChar];
      let code = 256;
      let phrase: string;
      for (let i = 1; i < data.length; i++) {
        const cc = data.charCodeAt(i);
        if (cc < 256) phrase = data[i];
        else phrase = dict[cc] ? dict[cc] : oldPhrase + currChar;
        out.push(phrase);
        currChar = phrase[0];
        dict[code] = oldPhrase + currChar;
        code++;
        oldPhrase = phrase;
      }
      return out.join("");
    };

    const BO_HOSTS = [
      "wss://ws1.blitzortung.org/",
      "wss://ws7.blitzortung.org/",
      "wss://ws8.blitzortung.org/",
      "wss://ws3.blitzortung.org/",
    ];
    let boIdx = 0;
    let boGotData = false;
    let boBudget = 40;
    let boRetryTimer: ReturnType<typeof setTimeout> | null = null;
    let ws: WebSocket | null = null;
    const boConnect = () => {
      if (disposed) return;
      try {
        ws = new WebSocket(BO_HOSTS[boIdx % BO_HOSTS.length]);
      } catch {
        boRetry();
        return;
      }
      boIdx++;
      ws.onopen = () => {
        try {
          ws?.send(JSON.stringify({ a: 111 }));
        } catch {}
      };
      ws.onmessage = (ev) => {
        try {
          const j = JSON.parse(lzwDecode(String(ev.data)));
          const lat = j.lat !== undefined ? j.lat : j.latitude;
          const lon = j.lon !== undefined ? j.lon : j.longitude;
          if (typeof lat === "number" && typeof lon === "number") {
            boGotData = true;
            if (boBudget > 0) {
              boBudget--;
              addStrike(lat, lon, clock.getElapsedTime());
            }
          }
        } catch {}
      };
      ws.onclose = () => boRetry();
      ws.onerror = () => {
        try {
          ws?.close();
        } catch {}
      };
    };
    const boRetry = () => {
      if (disposed) return;
      if (boRetryTimer) clearTimeout(boRetryTimer);
      boRetryTimer = setTimeout(boConnect, 3000);
    };
    const budgetTimer = setInterval(() => (boBudget = 40), 1000);
    // 雷データが届くまでは熱帯収束帯を模した擬似雷で見た目を維持
    const fallbackTimer = setInterval(() => {
      if (boGotData) return;
      const t = clock.getElapsedTime();
      for (let i = 0; i < 3; i++) {
        const lat = Math.random() < 0.72 ? Math.random() * 44 - 22 : Math.random() * 110 - 55;
        const lon = Math.random() * 360 - 180;
        addStrike(lat, lon, t);
      }
    }, 650);
    boConnect();

    /* ── 電離層グリッド共振 ── */
    const IONO_R = 1.08;
    const fibSphere = (n: number, r: number) => {
      const pts: THREE.Vector3[] = [];
      const g = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < n; i++) {
        const y = 1 - (i / (n - 1)) * 2;
        const rad = Math.sqrt(1 - y * y);
        const t = g * i;
        pts.push(new THREE.Vector3(Math.cos(t) * rad * r, y * r, Math.sin(t) * rad * r));
      }
      return pts;
    };
    const GP = fibSphere(80, IONO_R);
    const buildTris = () => {
      const tris: Array<[number, number, number]> = [];
      const used = new Set<string>();
      for (let i = 0; i < GP.length; i++) {
        const d: Array<{ j: number; d: number }> = [];
        for (let j = 0; j < GP.length; j++) {
          if (j !== i) d.push({ j, d: GP[i].distanceToSquared(GP[j]) });
        }
        d.sort((a, b) => a.d - b.d);
        for (let a = 0; a < Math.min(3, d.length); a++) {
          for (let b = a + 1; b < Math.min(4, d.length); b++) {
            const key = [i, d[a].j, d[b].j].sort((x, y) => x - y).join("-");
            if (!used.has(key)) {
              used.add(key);
              tris.push([i, d[a].j, d[b].j]);
            }
          }
        }
      }
      return tris;
    };
    const TRIS = buildTris();

    const permEdgeSet = new Set<string>();
    const permLinePos: number[] = [];
    for (const tri of TRIS) {
      const edges: Array<[number, number]> = [
        [tri[0], tri[1]],
        [tri[1], tri[2]],
        [tri[2], tri[0]],
      ];
      for (const e of edges) {
        const key = e[0] < e[1] ? `${e[0]}-${e[1]}` : `${e[1]}-${e[0]}`;
        if (!permEdgeSet.has(key)) {
          permEdgeSet.add(key);
          permLinePos.push(GP[e[0]].x, GP[e[0]].y, GP[e[0]].z, GP[e[1]].x, GP[e[1]].y, GP[e[1]].z);
        }
      }
    }
    const permLineG = new THREE.BufferGeometry();
    permLineG.setAttribute("position", new THREE.Float32BufferAttribute(permLinePos, 3));
    // 接続中は紫→蛍光水色にゆっくり変化する
    const gridMat = new THREE.LineBasicMaterial({
      color: 0x8a5aff,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    earth.add(new THREE.LineSegments(permLineG, gridMat));
    const GRID_PURPLE = new THREE.Color(0x8a5aff);
    const GRID_CYAN = new THREE.Color(0x40e8ff);


    interface GridWave {
      group: THREE.Group;
      birthTime: number;
      lifetime: number;
    }
    const gridWaves: GridWave[] = [];
    const spawnGridWave = (time: number) => {
      const group = new THREE.Group();
      const ratio = 0.3 + Math.random() * 0.2;
      const selected = TRIS.filter(() => Math.random() < ratio);
      if (selected.length < 5) return;
      const edgeSet = new Set<string>();
      const linePos: number[] = [];
      for (const tri of selected) {
        const edges: Array<[number, number]> = [
          [tri[0], tri[1]],
          [tri[1], tri[2]],
          [tri[2], tri[0]],
        ];
        for (const e of edges) {
          const key = e[0] < e[1] ? `${e[0]}-${e[1]}` : `${e[1]}-${e[0]}`;
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            linePos.push(GP[e[0]].x, GP[e[0]].y, GP[e[0]].z, GP[e[1]].x, GP[e[1]].y, GP[e[1]].z);
          }
        }
      }
      const lG = new THREE.BufferGeometry();
      lG.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
      group.add(
        new THREE.LineSegments(
          lG,
          new THREE.LineBasicMaterial({
            color: connectedRef.current ? 0x40e8ff : 0xa070ff,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        )
      );
      const reflectTris = selected.filter(() => Math.random() < 0.1 + Math.random() * 0.1);
      if (reflectTris.length > 0) {
        const rPos: number[] = [];
        for (const tri of reflectTris) {
          const p0 = GP[tri[0]], p1 = GP[tri[1]], p2 = GP[tri[2]];
          rPos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        }
        const rG = new THREE.BufferGeometry();
        rG.setAttribute("position", new THREE.Float32BufferAttribute(rPos, 3));
        group.add(
          new THREE.Mesh(
            rG,
            new THREE.MeshBasicMaterial({ color: 0xc090ff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
          )
        );
      }
      earth.add(group);
      gridWaves.push({ group, birthTime: time, lifetime: 2 + Math.random() * 1.5 });
      while (gridWaves.length > 2) {
        const old = gridWaves.shift()!;
        earth.remove(old.group);
      }
    };
    const updateGridWaves = (time: number) => {
      for (let i = gridWaves.length - 1; i >= 0; i--) {
        const w = gridWaves[i];
        const age = time - w.birthTime;
        if (age >= w.lifetime) {
          earth.remove(w.group);
          gridWaves.splice(i, 1);
          continue;
        }
        let o: number;
        if (age < 0.8) o = age / 0.8;
        else if (age > w.lifetime - 1.2) o = (w.lifetime - age) / 1.2;
        else o = 1.0;
        o *= 0.85 + 0.15 * Math.sin(time * 1.2 + w.birthTime * 2.0);
        w.group.children.forEach((c) => {
          const mesh = c as THREE.Mesh<THREE.BufferGeometry, THREE.Material & { opacity: number }>;
          if ((c as THREE.LineSegments).isLineSegments) mesh.material.opacity = o * 0.35;
          else if ((c as THREE.Mesh).isMesh) mesh.material.opacity = o * 0.2;
        });
      }
    };

    /* ── 金の光柱（いま聴いている人・presence実数） ── */
    const JP_SPOTS: Array<[number, number]> = [
      [35.68, 139.69], [34.69, 135.5], [43.06, 141.35], [26.34, 127.78], [33.59, 130.4],
      [38.27, 140.87], [36.59, 136.63], [35.18, 136.91], [34.4, 132.46], [31.56, 130.56],
      [37.9, 139.02], [33.84, 132.77], [35.02, 135.76], [40.82, 140.74],
    ];
    const pillarGroup = new THREE.Group();
    earth.add(pillarGroup);

    // 滲む光のテクスチャ（放射状グラデ: 中心=白く明るい → 外=透明）。
    // 固いドットではなくホタルのように霞んで光らせるため、スプライトに貼って使う。
    const glowTex = (() => {
      const s = 128;
      const cv = document.createElement("canvas");
      cv.width = cv.height = s;
      const ctx = cv.getContext("2d")!;
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0.0, "rgba(255,255,255,0.95)");
      g.addColorStop(0.18, "rgba(200,240,255,0.75)");
      g.addColorStop(0.45, "rgba(120,210,255,0.30)");
      g.addColorStop(0.75, "rgba(90,180,255,0.08)");
      g.addColorStop(1.0, "rgba(90,180,255,0.0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      const t = new THREE.CanvasTexture(cv);
      t.needsUpdate = true;
      return t;
    })();

    // 61点以上(将来の25,000人スケール)は Points 1本=1描画命令で描く。
    // スプライト2枚/点の方式は綺麗だが数万ドローコールになりSafariが死ぬので60点まで。
    let cloudMat: THREE.ShaderMaterial | null = null;
    const rebuildPillars = (list: Array<[number, number, number] | null>) => {
      pillarGroup.clear();
      cloudMat = null;
      if (list.length > 60) {
        const pos: number[] = [];
        const phase: number[] = [];
        const scl: number[] = [];
        list.forEach((loc, i) => {
          if (!loc) return;
          const v = ll2v(loc[0], loc[1], 1.006);
          pos.push(v.x, v.y, v.z);
          phase.push((i * 2.399963) % (Math.PI * 2)); // 黄金角で明滅位相をバラす
          scl.push(0.055 + Math.min(loc[2] ?? 1, 8) * 0.007);
        });
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute("aPhase", new THREE.Float32BufferAttribute(phase, 1));
        g.setAttribute("aScale", new THREE.Float32BufferAttribute(scl, 1));
        cloudMat = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uTex: { value: glowTex },
            uDpr: { value: renderer.getPixelRatio() },
          },
          vertexShader:
            "attribute float aPhase; attribute float aScale; uniform float uTime; uniform float uDpr; varying float vA;" +
            "void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);" +
            // ホタル型: 極小の点で生まれ→ほわわーんと膨らんで柔らかい霞になり→
            // 近くの光と溶け合い(加算合成)→ふっと消える。約8秒周期・位相バラバラ
            "  float p = fract(uTime * 0.125 + aPhase * 0.159155);" +
            "  float grow = smoothstep(0.0, 1.0, p);" +
            "  vA = smoothstep(0.0, 0.10, p) * (1.0 - smoothstep(0.45, 1.0, p));" +
            "  gl_PointSize = aScale * uDpr * (300.0 / -mv.z) * (0.06 + 2.1 * grow);" +
            "  gl_Position = projectionMatrix * mv; }",
          fragmentShader:
            "uniform sampler2D uTex; varying float vA;" +
            "void main(){ vec4 c = texture2D(uTex, gl_PointCoord);" +
            "  gl_FragColor = vec4(vec3(0.62, 0.87, 1.0) * c.rgb, c.a * vA); }",
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        pillarGroup.add(new THREE.Points(g, cloudMat));
        return;
      }
      const count = Math.min(list.length, 60);
      for (let i = 0; i < count; i++) {
        const loc = list[i];
        const lat = loc ? loc[0] : JP_SPOTS[i % JP_SPOTS.length][0] + ((i * 0.7) % 2) - 1;
        const lng = loc ? loc[1] : JP_SPOTS[i % JP_SPOTS.length][1] + ((i * 1.3) % 3) - 1.5;
        const crowd = Math.min(loc ? loc[2] : 1, 8);
        const base = ll2v(lat, lng, 1.006);
        // 大きく柔らかい滲み（人数で少し広がる）
        const haze = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: glowTex, color: 0x8fd8ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        const hazeR = 0.11 + crowd * 0.02;
        haze.scale.set(hazeR, hazeR, hazeR);
        haze.position.copy(base);
        haze.userData.baseOpacity = 0.5;
        pillarGroup.add(haze);
        // 内側の明るい芯（同じグラデを小さく重ねてホタルの核に）
        const coreS = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: glowTex, color: 0xeaf8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        const coreR = 0.045 + crowd * 0.006;
        coreS.scale.set(coreR, coreR, coreR);
        coreS.position.copy(base);
        coreS.userData.baseOpacity = 0.9;
        pillarGroup.add(coreS);
      }
    };

    /* ── 流星 ── */
    interface Meteor {
      line: THREE.Line;
      pos: THREE.Vector3;
      vel: THREE.Vector3;
      birth: number;
      life: number;
    }
    const meteors: Meteor[] = [];
    const rndDir = () => {
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      return new THREE.Vector3(Math.sin(p) * Math.cos(t), Math.sin(p) * Math.sin(t), Math.cos(p));
    };
    const spawnMeteor = (time: number) => {
      const pos = rndDir().multiplyScalar(16 + Math.random() * 14);
      pos.z = -Math.abs(pos.z) * 0.5 - 6;
      const vel = rndDir().multiplyScalar(18 + Math.random() * 14);
      const g = new THREE.BufferGeometry().setFromPoints([pos, pos]);
      const m = new THREE.LineBasicMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const line = new THREE.Line(g, m);
      scene.add(line);
      meteors.push({ line, pos: pos.clone(), vel, birth: time, life: 1.0 + Math.random() * 0.8 });
    };
    const updateMeteors = (t: number, dt: number) => {
      for (let i = meteors.length - 1; i >= 0; i--) {
        const mt = meteors[i];
        const age = t - mt.birth;
        if (age > mt.life) {
          scene.remove(mt.line);
          meteors.splice(i, 1);
          continue;
        }
        mt.pos.addScaledVector(mt.vel, dt);
        const tail = mt.pos.clone().addScaledVector(mt.vel, -0.14);
        mt.line.geometry.setFromPoints([tail, mt.pos]);
        const k = age / mt.life;
        (mt.line.material as THREE.LineBasicMaterial).opacity = 0.85 * Math.sin(Math.PI * Math.min(1, k));
      }
    };

    /* ── 操作（横ドラッグ=回転 / 縦スワイプ=ページスクロール / ピンチ=ズーム） ── */
    let dragging = false, prevX = 0, prevY = 0, velX = 0, velY = 0;
    let rotX = 0.3, rotY = -2.55, targetZ = 2.85, lastPinch = 0;
    earth.rotation.x = rotX;
    earth.rotation.y = rotY;
    const el = renderer.domElement;
    const onMouseDown = (e: MouseEvent) => { dragging = true; prevX = e.clientX; prevY = e.clientY; velX = velY = 0; };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      velY = (e.clientX - prevX) * 0.005;
      velX = (e.clientY - prevY) * 0.005;
      rotY += velY; rotX += velX;
      rotX = Math.max(-1.5, Math.min(1.5, rotX));
      prevX = e.clientX; prevY = e.clientY;
    };
    const onMouseUp = () => (dragging = false);
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    let touchLock: "rotate" | "scroll" | "pinch" | null = null;
    let touchStartX = 0, touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchLock = null; dragging = false;
        touchStartX = prevX = e.touches[0].clientX;
        touchStartY = prevY = e.touches[0].clientY;
        velX = velY = 0;
      } else if (e.touches.length === 2) {
        e.preventDefault();
        touchLock = "pinch"; dragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinch = Math.sqrt(dx * dx + dy * dy);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 || touchLock === "pinch") {
        e.preventDefault();
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (lastPinch > 0) {
            targetZ += (lastPinch - dist) * 0.02;
            targetZ = Math.max(1.22, Math.min(10, targetZ));
          }
          lastPinch = dist;
        }
        return;
      }
      const tx = e.touches[0].clientX, ty = e.touches[0].clientY;
      if (touchLock === null) {
        const adx = Math.abs(tx - touchStartX), ady = Math.abs(ty - touchStartY);
        if (adx > 7 || ady > 7) {
          touchLock = adx > ady * 0.6 ? "rotate" : "scroll";
          if (touchLock === "rotate") { dragging = true; prevX = tx; prevY = ty; }
        }
        if (touchLock !== "rotate") return;
      }
      if (touchLock === "scroll") return;
      e.preventDefault();
      velY = (tx - prevX) * 0.005;
      velX = (ty - prevY) * 0.005;
      rotY += velY; rotX += velX;
      rotX = Math.max(-1.5, Math.min(1.5, rotX));
      prevX = tx; prevY = ty;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) { dragging = false; lastPinch = 0; touchLock = null; }
    };
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });

    /* ── アニメーション ── */
    const AUTO_SPIN = 0.07;
    const GRID_INTERVAL = 3, GRID_FIRST_DELAY = 2;
    let lastGridTime = 0;
    let nextMeteorAt = 5 + Math.random() * 7;
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const t = clock.getElapsedTime();
      ffMat.uniforms.uTime.value = t;
      if (strikesDirty) {
        ["position", "aSize", "aPhase", "aInt", "aBorn"].forEach((n) => {
          (fG.getAttribute(n) as THREE.BufferAttribute).needsUpdate = true;
        });
        strikesDirty = false;
      }
      if (t > GRID_FIRST_DELAY && t - lastGridTime > GRID_INTERVAL) {
        spawnGridWave(t);
        lastGridTime = t;
      }
      updateGridWaves(t);
      if (t > nextMeteorAt) {
        spawnMeteor(t);
        nextMeteorAt = t + 6 + Math.random() * 14;
      }
      updateMeteors(t, dt);
      // 表示モード: OTOHIKARI MAP=光柱のみ / sprite&thunder MAP=雷のみ / ALL=両方
      strikePoints.visible = modeRef.current !== "otohikari";
      pillarGroup.visible = modeRef.current !== "thunder";
      // MasterMind接続中: グリッドが紫→蛍光水色に息づく
      gridMat.color.lerp(connectedRef.current ? GRID_CYAN : GRID_PURPLE, 0.04);
      const targetOp = connectedRef.current ? 0.3 + 0.1 * Math.sin(t * 2.2) : 0.15;
      gridMat.opacity += (targetOp - gridMat.opacity) * 0.06;
      // 光柱: presence が更新された時だけ組み直す(毎フレームの文字列化はSafariの主スレッドを削るのでやめた)
      if (spotsDirtyRef.current) {
        spotsDirtyRef.current = false;
        rebuildPillars(spotsRef.current);
      }
      if (cloudMat) cloudMat.uniforms.uTime.value = t; // Points版の明滅はGPU側(シェーダー)で
      pillarGroup.children.forEach((c, i) => {
        if ((c as THREE.Points).isPoints) return;
        const m = (c as THREE.Sprite).material as THREE.Material & { opacity: number };
        const base = (c.userData.baseOpacity as number) ?? 0.6;
        // ホタルの明滅（芯とハロで位相をずらして柔らかく息づく）
        const breath = 0.62 + 0.38 * Math.sin(t * 1.1 + i * 1.3);
        m.opacity = base * breath;
      });
      if (!dragging) {
        velX *= 0.94; velY *= 0.94;
        rotY += velY; rotX += velX;
        rotY += AUTO_SPIN * dt;
      }
      earth.rotation.y += (rotY - earth.rotation.y) * 0.1;
      earth.rotation.x += (rotX - earth.rotation.x) * 0.1;
      camera.position.z += (targetZ - camera.position.z) * 0.08;
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = host.clientWidth;
      camera.aspect = w / H;
      camera.updateProjectionMatrix();
      renderer.setSize(w, H);
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      clearInterval(budgetTimer);
      clearInterval(fallbackTimer);
      if (boRetryTimer) clearTimeout(boRetryTimer);
      try {
        ws?.close();
      } catch {}
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      id="otohikari-globe"
      ref={hostRef}
      style={{ height: 360, borderRadius: 0, overflow: "hidden", background: "linear-gradient(180deg,#050a14,#0a1a2e)" }}
      aria-label="地球儀 — 雷はリアルタイム観測、金の柱はいま聴いている人"
    />
  );
}
