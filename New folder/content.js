(function() {
    'use strict';

    let canvas, ctx;
    let blobs = [];
    let worms = [];
    let mouse = { x: 0, y: 0, down: false, grabbedObj: null, physMode: false, sliceMode: false, sliceStart: null };
    let guisShowing = true;
    
    const DEFAULTS = { timescale: 2, gravity: 0.8, damping: 0.94, softness: 0.15, size: 60, color: '#00ff00' };
    let bSet = { ...DEFAULTS };
    let wSet = { length: 15, wiggle: 1.5 };

    function injectStyles() {
        if (document.getElementById('SIM-STYLES')) return;
        const style = document.createElement('style');
        style.id = 'SIM-STYLES';
        style.textContent = `
            .sim-gui { position: fixed; background: #111; color: #fff; border: 1px solid #444; 
                       font-family: 'Segoe UI', monospace; z-index: 2147483647; padding: 12px; 
                       user-select: none; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                       transition: opacity 0.2s ease, transform 0.2s ease; }
            .sim-gui.hidden { opacity: 0; pointer-events: none; transform: translateY(-10px); }
            .sim-header { padding: 6px; margin: -12px -12px 10px -12px; border-radius: 8px 8px 0 0; 
                          font-weight: bold; cursor: move; text-align: center; font-size: 11px; text-transform: uppercase; }
            .sim-btn { width: 100%; padding: 8px; margin-top: 5px; cursor: pointer; border: none; 
                       border-radius: 4px; font-weight: bold; font-size: 11px; transition: 0.2s; }
            .sim-label { font-size: 9px; color: #888; display: block; margin-top: 8px; font-weight: bold; }
            input[type=range] { width: 100%; margin: 4px 0; cursor: pointer; }
        `;
        document.head.appendChild(style);
    }

    function createGuis() {
        if (document.getElementById('BLOB-SIM-ROOT')) return;
        injectStyles();

        const bMenu = document.createElement('div');
        bMenu.id = 'BLOB-SIM-ROOT'; bMenu.className = 'sim-gui';
        bMenu.style.top = '20px'; bMenu.style.left = '20px'; bMenu.style.width = '200px';
        bMenu.style.borderColor = '#00ff00';
        bMenu.innerHTML = `
            <div class="sim-header" style="background:#00ff00; color:#000">BLOB SETTINGS</div>
            <button id="btn-spawn-b" class="sim-btn" style="background:#00ff00; color:#000">SPAWN BLOB</button>
            <button id="btn-phys" class="sim-btn" style="background:#222; color:#00ff00; border:1px solid #00ff00">PHYS MOUSE: OFF</button>
            <button id="btn-slice" class="sim-btn" style="background:#222; color:#00ffff; border:1px solid #00ffff">SLICER: OFF</button>
            <span class="sim-label">SOFTNESS</span>
            <input type="range" id="sld-soft" min="5" max="50" value="15">
            <span class="sim-label">GRAVITY</span>
            <input type="range" id="sld-grav" min="0" max="30" value="8">
            <span class="sim-label">SIZE</span>
            <input type="range" id="sld-size" min="20" max="150" value="60">
            <button id="btn-reset" class="sim-btn" style="background:#333; color:#fff; margin-top:15px">RESET DEFAULTS</button>
            <button id="btn-clear-b" class="sim-btn" style="background:#422; color:#f88">CLEAR BLOBS</button>
        `;

        const wMenu = document.createElement('div');
        wMenu.id = 'WORM-LAB-ROOT'; wMenu.className = 'sim-gui';
        wMenu.style.top = '20px'; wMenu.style.left = '240px'; wMenu.style.width = '180px';
        wMenu.style.borderColor = '#ff00ff';
        wMenu.innerHTML = `
            <div class="sim-header" style="background:#ff00ff; color:#fff">WORM LAB</div>
            <button id="btn-spawn-w" class="sim-btn" style="background:#ff00ff; color:#fff">SPAWN WORM</button>
            <span class="sim-label">WORM LENGTH</span>
            <input type="range" id="sld-w-len" min="5" max="60" value="15">
            <span class="sim-label">WIGGLE INTENSITY</span>
            <input type="range" id="sld-w-wig" min="0" max="100" value="15">
            <button id="btn-kill-w" class="sim-btn" style="background:#422; color:#f88; margin-top:15px">KILL ALL WORMS</button>
            <div style="font-size:8px; color:#555; text-align:center; margin-top:8px">TAB TO HIDE GUI</div>
        `;

        document.body.appendChild(bMenu);
        document.body.appendChild(wMenu);
        setupEvents();
    }

    function setupEvents() {
        const get = (id) => document.getElementById(id);
        get('btn-spawn-b').onclick = () => spawnBlob();
        get('btn-spawn-w').onclick = () => spawnWorm();
        get('btn-clear-b').onclick = () => blobs = [];
        get('btn-kill-w').onclick = () => worms = [];

        get('btn-phys').onclick = (e) => {
            mouse.physMode = !mouse.physMode;
            e.target.innerText = `PHYS MOUSE: ${mouse.physMode ? 'ON' : 'OFF'}`;
            e.target.style.background = mouse.physMode ? '#00ff00' : '#222';
            e.target.style.color = mouse.physMode ? '#000' : '#00ff00';
        };

        get('btn-slice').onclick = (e) => {
            mouse.sliceMode = !mouse.sliceMode;
            e.target.innerText = `SLICER: ${mouse.sliceMode ? 'ON' : 'OFF'}`;
            e.target.style.background = mouse.sliceMode ? '#00ffff' : '#222';
            e.target.style.color = mouse.sliceMode ? '#000' : '#00ffff';
        };

        get('btn-reset').onclick = () => {
            bSet = { ...DEFAULTS };
            get('sld-soft').value = 15; get('sld-grav').value = 8; get('sld-size').value = 60;
        };

        get('sld-soft').oninput = (e) => bSet.softness = e.target.value / 100;
        get('sld-grav').oninput = (e) => bSet.gravity = e.target.value / 10;
        get('sld-size').oninput = (e) => bSet.size = parseInt(e.target.value);
        get('sld-w-len').oninput = (e) => wSet.length = parseInt(e.target.value);
        get('sld-w-wig').oninput = (e) => wSet.wiggle = e.target.value / 10;

        window.addEventListener('keydown', (e) => {
            if (e.key === "Tab") {
                e.preventDefault(); 
                guisShowing = !guisShowing;
                document.querySelectorAll('.sim-gui').forEach(el => el.classList.toggle('hidden', !guisShowing));
            }
        });

        [get('BLOB-SIM-ROOT'), get('WORM-LAB-ROOT')].forEach(menu => {
            const header = menu.querySelector('.sim-header');
            let isDragging = false, ox, oy;
            header.onmousedown = (e) => { isDragging = true; ox = e.clientX - menu.offsetLeft; oy = e.clientY - menu.offsetTop; };
            window.addEventListener('mousemove', (e) => { if(isDragging) { menu.style.left = (e.clientX-ox)+'px'; menu.style.top = (e.clientY-oy)+'px'; } });
            window.addEventListener('mouseup', () => isDragging = false);
        });

        initCanvas();
    }

    class Worm {
        constructor(x, y, len, wig) {
            this.segments = [];
            this.timer = Math.random() * 100;
            this.wiggle = wig;
            this.distLimit = 7;
            for (let i = 0; i < len; i++) this.segments.push({ x: x, y: y + (i * this.distLimit), vx: 0, vy: 0 });
        }
        update() {
            this.timer += 0.04;
            let head = this.segments[0];
            if (mouse.down && mouse.grabbedObj === this) {
                head.vx = (mouse.x - head.x) * 0.2; head.vy = (mouse.y - head.y) * 0.2;
            } else {
                head.vx += Math.cos(this.timer) * 0.5; head.vy += Math.sin(this.timer * 0.5) * this.wiggle + 0.2;
            }
            head.vx *= 0.9; head.vy *= 0.9;
            head.x += head.vx; head.y += head.vy;

            for (let i = 1; i < this.segments.length; i++) {
                let p = this.segments[i], prev = this.segments[i-1];
                p.vy += 0.15; p.vx *= 0.92; p.vy *= 0.92;
                p.x += p.vx; p.y += p.vy;
                let dx = p.x - prev.x, dy = p.y - prev.y, distance = Math.hypot(dx, dy);
                if (distance > this.distLimit) {
                    let angle = Math.atan2(dy, dx);
                    p.x = prev.x + Math.cos(angle) * this.distLimit;
                    p.y = prev.y + Math.sin(angle) * this.distLimit;
                    p.vx = prev.vx * 0.5; p.vy = prev.vy * 0.5;
                }
            }
            this.segments.forEach(p => {
                if (p.y > window.innerHeight - 5) { p.y = window.innerHeight - 5; p.vy = 0; }
                if (p.x < 5) { p.x = 5; p.vx = 0; }
                if (p.x > window.innerWidth - 5) { p.x = window.innerWidth - 5; p.vx = 0; }
            });
        }
    }

    function spawnBlob(x, y, customSize) {
        if (!canvas) initCanvas();
        const b = { points: [], softness: bSet.softness, gravity: bSet.gravity, size: customSize || bSet.size, damping: bSet.damping, color: bSet.color };
        const sx = x || window.innerWidth / 2, sy = y || window.innerHeight / 2;
        for (let i = 0; i < 18; i++) {
            let a = (i / 18) * Math.PI * 2;
            b.points.push({ x: sx + Math.cos(a) * b.size, y: sy + Math.sin(a) * b.size, vx: 0, vy: 0, angle: a });
        }
        blobs.push(b);
    }

    function spawnWorm() {
        if (!canvas) initCanvas();
        worms.push(new Worm(window.innerWidth/2, window.innerHeight/3, wSet.length, wSet.wiggle));
    }

    function sliceBlobs(p1, p2) {
        let toRemove = [], toAdd = [];
        blobs.forEach((b, idx) => {
            let cx = b.points.reduce((s,p)=>s+p.x,0)/b.points.length, cy = b.points.reduce((s,p)=>s+p.y,0)/b.points.length;
            let d = Math.abs((p2.y-p1.y)*cx - (p2.x-p1.x)*cy + p2.x*p1.y - p2.y*p1.x) / Math.hypot(p2.y-p1.y, p2.x-p1.x);
            if (d < b.size) {
                toRemove.push(idx);
                toAdd.push({x: cx - b.size/2, y: cy, size: b.size * 0.65});
                toAdd.push({x: cx + b.size/2, y: cy, size: b.size * 0.65});
            }
        });
        blobs = blobs.filter((_, i) => !toRemove.includes(i));
        toAdd.forEach(a => spawnBlob(a.x, a.y, a.size));
    }

    function initCanvas() {
        if (canvas) return;
        canvas = document.createElement('canvas');
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;
        Object.assign(canvas.style, { position: 'fixed', top: '0', left: '0', pointerEvents: 'none', zIndex: '2147483645' });
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
        window.addEventListener('mousedown', (e) => {
            if (e.target.closest('.sim-gui')) return;
            if (mouse.sliceMode) { mouse.sliceStart = {x: e.clientX, y: e.clientY}; return; }
            mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY;
            worms.forEach(w => { if(Math.hypot(w.segments[0].x-mouse.x, w.segments[0].y-mouse.y) < 50) mouse.grabbedObj = w; });
            if(!mouse.grabbedObj) blobs.forEach(b => {
                let bx = b.points.reduce((s,p)=>s+p.x,0)/b.points.length, by = b.points.reduce((s,p)=>s+p.y,0)/b.points.length;
                if (Math.hypot(bx - mouse.x, by - mouse.y) < b.size * 1.2) mouse.grabbedObj = b;
            });
        });
        window.addEventListener('mouseup', (e) => {
            if (mouse.sliceMode && mouse.sliceStart) { sliceBlobs(mouse.sliceStart, {x: e.clientX, y: e.clientY}); mouse.sliceStart = null; }
            mouse.down = false; mouse.grabbedObj = null;
        });
        window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
        window.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.sim-gui')) return;
            worms = worms.filter(w => Math.hypot(w.segments[0].x - e.clientX, w.segments[0].y - e.clientY) > 40);
        });
        requestAnimationFrame(loop);
    }

    function loop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let s = 0; s < bSet.timescale; s++) {
            blobs.forEach(b => {
                let cx = b.points.reduce((s, p) => s + p.x, 0) / b.points.length, cy = b.points.reduce((s, p) => s + p.y, 0) / b.points.length;
                if (mouse.down && b === mouse.grabbedObj) { cx += (mouse.x - cx) * 0.1; cy += (mouse.y - cy) * 0.1; }
                b.points.forEach(p => {
                    let tx = cx + Math.cos(p.angle) * b.size, ty = cy + Math.sin(p.angle) * b.size;
                    p.vx += (tx - p.x) * b.softness; p.vy += (ty - p.y) * b.softness + b.gravity;
                    if (mouse.physMode) {
                        let d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
                        if (d < 150) { let f = (150 - d) * 0.12; p.vx += ((p.x-mouse.x)/d)*f; p.vy += ((p.y-mouse.y)/d)*f; }
                    }
                    p.vx *= b.damping; p.vy *= b.damping; p.x += p.vx; p.y += p.vy;
                    if (p.y > canvas.height - 5) { p.y = canvas.height - 5; p.vy *= -0.5; }
                });
            });

            // --- RESTORED BLOB COLLISION ---
            for(let i=0; i < blobs.length; i++) {
                for(let j=i+1; j < blobs.length; j++) {
                    let b1 = blobs[i], b2 = blobs[j];
                    let c1x = b1.points.reduce((s,p)=>s+p.x,0)/b1.points.length, c1y = b1.points.reduce((s,p)=>s+p.y,0)/b1.points.length;
                    let c2x = b2.points.reduce((s,p)=>s+p.x,0)/b2.points.length, c2y = b2.points.reduce((s,p)=>s+p.y,0)/b2.points.length;
                    let dist = Math.hypot(c2x - c1x, c2y - c1y);
                    let min = b1.size + b2.size;
                    if(dist < min) {
                        let force = (min - dist) * 0.04;
                        let nx = (c2x - c1x) / dist, ny = (c2y - c1y) / dist;
                        b1.points.forEach(p => { p.vx -= nx * force; p.vy -= ny * force; });
                        b2.points.forEach(p => { p.vx += nx * force; p.vy += ny * force; });
                    }
                }
            }
            worms.forEach(w => w.update());
        }
        if (mouse.sliceMode && mouse.sliceStart) {
            ctx.beginPath(); ctx.strokeStyle = '#0ff'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
            ctx.moveTo(mouse.sliceStart.x, mouse.sliceStart.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke(); ctx.setLineDash([]);
        }
        blobs.forEach(b => {
            ctx.beginPath(); ctx.fillStyle = b.color + 'AA'; ctx.strokeStyle = b.color; ctx.lineWidth = 2;
            for(let i=0; i<b.points.length; i++) {
                let p1 = b.points[i], p2 = b.points[(i+1)%b.points.length], mx=(p1.x+p2.x)/2, my=(p1.y+p2.y)/2;
                if(i===0) ctx.moveTo(mx,my); else ctx.quadraticCurveTo(p1.x,p1.y,mx,my);
            }
            ctx.closePath(); ctx.fill(); ctx.stroke();
        });
        worms.forEach(w => {
            ctx.beginPath(); ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.strokeStyle = '#ff00ff';
            ctx.moveTo(w.segments[0].x, w.segments[0].y); w.segments.forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w.segments[0].x, w.segments[0].y, 3, 0, Math.PI*2); ctx.fill();
        });
        requestAnimationFrame(loop);
    }

    if (document.body) createGuis();
    else { const obs = new MutationObserver(() => { if (document.body) { createGuis(); obs.disconnect(); } }); obs.observe(document.documentElement, { childList: true }); }
})();