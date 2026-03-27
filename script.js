/* ══════════════════════════════════════════════
   모닥불 — Campfire Landing Page
   script.js  — Scroll-driven animation engine
   ══════════════════════════════════════════════ */

'use strict';

// ── Utility ──────────────────────────────────────
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const lerp = (a, b, t) => a + (b - a) * t;
const map = (v, a, b, c, d) => c + (v - a) / (b - a) * (d - c);
const mapC = (v, a, b, c, d) => clamp(map(v, a, b, c, d), Math.min(c, d), Math.max(c, d));

// ── Canvas & Stars ────────────────────────────────
const canvas = document.getElementById('sky-canvas');
const ctx = canvas.getContext('2d');

let W = 0, H = 0;
function resizeCanvas() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Regular twinkling stars
const STAR_COUNT = 200;
const stars = [];
for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
        x: Math.random(),
        y: Math.random() * 0.75, // upper 75% of sky
        r: Math.random() * 1.3 + 0.3,
        alpha: Math.random() * 0.6 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.5 + 0.2,
        // Each star has a "birth" scroll threshold
        born: Math.random(),
    });
}

// Shooting stars pool
const shootingStars = [];
let lastShootTime = 0;

function spawnShootingStar() {
    shootingStars.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.5,
        len: 80 + Math.random() * 100,
        speed: 7 + Math.random() * 6,
        angle: Math.PI / 4 + (Math.random() - 0.5) * 0.4,
        alpha: 0.9,
        life: 1,
    });
}

// Ember particles floating up from the fire
const embers = [];
function spawnEmber(fireX, fireY) {
    embers.push({
        x: fireX + (Math.random() - 0.5) * 30,
        y: fireY,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -(1 + Math.random() * 2),
        r: Math.random() * 2 + 0.5,
        alpha: 0.9,
        life: 1,
    });
}

// Smoke particles
const smoke = [];
function spawnSmoke(fireX, fireY) {
    smoke.push({
        x: fireX + (Math.random() - 0.5) * 16,
        y: fireY - 10,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -(0.6 + Math.random() * 0.8),
        r: 8 + Math.random() * 10,
        alpha: 0.06,
        life: 1,
    });
}

// ── Scroll State ─────────────────────────────────
const scrollEl = document.documentElement;
let scrollY = 0;
let scrollMax = 1;

// Scroll progress 0-1 across total document
let prog = 0;

// Named scroll checkpoints (fraction of total scroll)
const CP = {
    starGrow: 0.08,  // star starts growing
    starGlow: 0.18,  // star fully glowing
    starShake: 0.24,  // star shakes / energy buildup
    starTransform: 0.30, // star becomes ember
    emberDrop: 0.38,  // ember descends to fire
    fireAppear: 0.44,  // fire scene appears
    fireGrow: 0.55,  // fire fully grown
    contentFade: 0.60,  // content sections readable
};

// ── DOM Refs ──────────────────────────────────────
const bgGrad = document.getElementById('bg-gradient');
const focalStar = document.getElementById('focal-star');
const fireScene = document.getElementById('fire-scene');
const header = document.getElementById('header');
const scrollHint = document.getElementById('scroll-hint');

// ── Color helpers ─────────────────────────────────
function lerpColor(c1, c2, t) {
    // c1, c2 as [r,g,b]
    return c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
}

function rgbStr(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }

// Background gradient color stops
const bgTop = [
    [3, 4, 10],   // deep night
    [6, 12, 26],   // navy
    [13, 21, 48],   // deep blue
    [26, 14, 48],   // purple
    [40, 14, 12],   // dark plum-orange
    [18, 8, 4],    // coal dark
];
const bgBot = [
    [3, 4, 10],
    [6, 12, 22],
    [10, 16, 34],
    [20, 10, 32],
    [50, 20, 8],
    [28, 10, 4],
];

function getBgColors(p) {
    const steps = bgTop.length - 1;
    const fi = p * steps;
    const i = Math.min(Math.floor(fi), steps - 1);
    const t = fi - i;
    return {
        top: lerpColor(bgTop[i], bgTop[i + 1], t),
        bot: lerpColor(bgBot[i], bgBot[i + 1], t),
    };
}

// ── Focal Star position (viewport Y) ─────────────
// Starts at ~22% vh, descends to ~82% vh (campfire position)
const STAR_START_Y = 0.22;
const STAR_END_Y = 0.82;
const STAR_START_X = 0.52;

function getFocalStarPos(p) {
    // Phase 1: idle until CP.starGrow, then follows scroll down
    const t = mapC(p, CP.starGrow, CP.emberDrop, 0, 1);
    return {
        x: STAR_START_X * 100,                              // %
        y: lerp(STAR_START_Y, STAR_END_Y, t) * 100,        // %
    };
}

// ── RAF loop ──────────────────────────────────────
let rafId = null;
let lastTime = 0;

function tick(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    scrollY = window.scrollY;
    scrollMax = scrollEl.scrollHeight - window.innerHeight;
    prog = scrollMax > 0 ? clamp(scrollY / scrollMax, 0, 1) : 0;

    updateBackground(prog);
    updateFocalStar(prog);
    updateFireScene(prog);
    updateHeader(prog);
    drawCanvas(prog, now, dt);

    rafId = requestAnimationFrame(tick);
}

// ── Background Update ─────────────────────────────
function updateBackground(p) {
    const { top, bot } = getBgColors(p);
    bgGrad.style.background =
        `linear-gradient(180deg, ${rgbStr(top)} 0%, ${rgbStr(bot)} 100%)`;
}

// ── Focal Star Update ─────────────────────────────
function updateFocalStar(p) {
    const pos = getFocalStarPos(p);
    focalStar.style.left = pos.x + '%';
    focalStar.style.top = pos.y + '%';

    if (p < CP.starGrow) {
        focalStar.className = '';
    } else if (p < CP.starGlow) {
        focalStar.className = 'glowing';
    } else if (p < CP.starTransform) {
        focalStar.className = 'glowing';
        // Add shake effect
        if (p > CP.starShake) {
            const intensity = mapC(p, CP.starShake, CP.starTransform, 0, 4);
            const sx = (Math.random() - 0.5) * intensity;
            const sy = (Math.random() - 0.5) * intensity;
            focalStar.style.transform =
                `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px))`;
        }
    } else if (p < CP.fireAppear) {
        focalStar.className = 'ember';
        focalStar.style.transform = 'translate(-50%, -50%)';
    } else {
        focalStar.className = 'hidden';
        focalStar.style.transform = 'translate(-50%, -50%)';
    }
}

// ── Fire Scene Update ─────────────────────────────
const campfireImage = document.getElementById('campfire-image');

function updateFireScene(p) {
    if (p >= CP.fireAppear) {
        fireScene.classList.add('visible');
        campfireImage?.classList.add('visible');
    } else {
        fireScene.classList.remove('visible');
        campfireImage?.classList.remove('visible');
    }
}

// ── Header Update ─────────────────────────────────
function updateHeader(p) {
    if (scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
    if (p > CP.fireGrow) {
        header.classList.add('warm');
    } else {
        header.classList.remove('warm');
    }
}

// ── Scroll-Reveal Elements (Intersection Observer) ──
const revealEls = document.querySelectorAll('[data-reveal], .section-title, .section-body, .gathering-inner .section-title, .gathering-inner .section-body');

// 뷰포트에 요소가 15% 이상 들어왔을 때 애니메이션 실행
const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target); // 한 번만 실행
        }
    });
}, {
    root: null,
    rootMargin: '0px 0px -15% 0px',
    threshold: 0
});

revealEls.forEach(el => revealObserver.observe(el));

// ── Canvas Draw ───────────────────────────────────
let emberSpawnTimer = 0;
let smokeSpawnTimer = 0;
let shootSpawnTimer = 0;

function drawCanvas(p, now, dt) {
    ctx.clearRect(0, 0, W, H);

    // -- Stars --
    const starAlphaGlobal = mapC(p, 0, CP.emberDrop, 1, 0.05);
    stars.forEach(s => {
        // Stars gradually appear based on their born threshold
        const appear = mapC(p / (CP.starGrow * 1.5), s.born, s.born + 0.2, 0, 1);
        const pulse = Math.sin(now * 0.001 * s.speed + s.phase) * 0.15;
        const alpha = (s.alpha + pulse) * starAlphaGlobal * appear;
        if (alpha <= 0) return;

        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(210, 225, 255, ${alpha})`;
        ctx.fill();
    });

    // -- Shooting Stars --
    shootSpawnTimer += dt;
    if (p < CP.fireAppear && shootSpawnTimer > (4 + Math.random() * 5)) {
        shootSpawnTimer = 0;
        spawnShootingStar();
    }

    for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        ss.x += Math.cos(ss.angle) * ss.speed;
        ss.y += Math.sin(ss.angle) * ss.speed;
        ss.life -= dt * 0.8;
        if (ss.life <= 0) { shootingStars.splice(i, 1); continue; }

        const grad = ctx.createLinearGradient(
            ss.x, ss.y,
            ss.x - Math.cos(ss.angle) * ss.len,
            ss.y - Math.sin(ss.angle) * ss.len
        );
        grad.addColorStop(0, `rgba(255,255,255,${ss.life * 0.8})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(ss.x - Math.cos(ss.angle) * ss.len, ss.y - Math.sin(ss.angle) * ss.len);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    // -- Ember Particles (only when fire is visible) --
    if (p >= CP.fireAppear) {
        const fireX = W * STAR_START_X;
        const fireY = H * 0.82;

        emberSpawnTimer += dt;
        if (emberSpawnTimer > 0.08) {
            emberSpawnTimer = 0;
            spawnEmber(fireX, fireY - 40);
        }

        smokeSpawnTimer += dt;
        if (smokeSpawnTimer > 0.25) {
            smokeSpawnTimer = 0;
            spawnSmoke(fireX, fireY - 80);
        }
    }

    for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i];
        e.x += e.vx;
        e.y += e.vy;
        e.vx += (Math.random() - 0.5) * 0.1;
        e.life -= dt * 0.6;
        e.alpha = e.life * 0.85;
        if (e.life <= 0) { embers.splice(i, 1); continue; }

        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, ${100 + Math.random() * 100}, 30, ${e.alpha})`;
        ctx.fill();
    }

    // Smoke
    for (let i = smoke.length - 1; i >= 0; i--) {
        const s = smoke[i];
        s.x += s.vx;
        s.y += s.vy;
        s.r += dt * 8;
        s.life -= dt * 0.3;
        s.alpha = s.life * 0.06;
        if (s.life <= 0) { smoke.splice(i, 1); continue; }

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(160, 130, 100, ${s.alpha})`;
        ctx.fill();
    }
}

// ── Cinematic Scroll Interaction Config ──────────
const CINEMATIC_CONFIG = {
    milestones: [0, 0.5, 0.63, 0.75, 0.87, 1.0], // 로딩 시 계산됨
    duration: 1600
};

// 해상도(QHD, FHD 등)에 따라 콘텐츠가 항상 모니터 한가운데 오도록 비율을 자동 재계산합니다.
function refreshMilestones() {
    const sMax = scrollEl.scrollHeight - window.innerHeight;
    if (sMax <= 0) return;

    const sections = [
        '#hero-section',
        '#gathering-section',
        '#about-section',
        '#features-section',
        '#rules-section',
        '#join-section'
    ];

    const newMilestones = sections.map((id, index) => {
        // 첫 화면은 무조건 0으로 고정
        if (index === 0) return 0;

        const el = document.querySelector(id);
        if (!el) return 0;

        // 핵심: 우선 정중앙 정렬을 베이스로 합니다 (+60 여백이 과하게 위로 올려치는 원인이었으므로 제거)
        let targetScroll = el.offsetTop - (window.innerHeight / 2) + (el.offsetHeight / 2);

        // 마지막 최하단 스크롤(index 5)은 10% 아래로 배치
        if (index === sections.length - 1) {
            targetScroll -= (window.innerHeight * 0.10);
        }
        // 두 번째 스크롤(소개 챕터, index 2)부터 마지막 이전까지는 2% 아래로 배치
        else if (index >= 2) {
            targetScroll -= (window.innerHeight * 0.02);
        }

        return Math.max(0, Math.min(targetScroll / sMax, 1));
    });

    CINEMATIC_CONFIG.milestones = newMilestones;
}

window.addEventListener('resize', refreshMilestones);
window.addEventListener('load', refreshMilestones);
refreshMilestones();

let isCinematicScrolling = false;
function triggerCinematicScroll(targetProg, duration = CINEMATIC_CONFIG.duration) {
    if (isCinematicScrolling) return;

    const currentScroll = window.scrollY;
    const scrollMax = scrollEl.scrollHeight - window.innerHeight;
    const targetScroll = Math.max(0, Math.min(scrollMax * targetProg, scrollMax));

    if (Math.abs(currentScroll - targetScroll) < 10) return;

    isCinematicScrolling = true;
    const startTime = performance.now();
    const startScroll = currentScroll;

    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const ease = progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        window.scrollTo(0, startScroll + (targetScroll - startScroll) * ease);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            isCinematicScrolling = false;
        }
    }

    requestAnimationFrame(animate);
}

// Prevent native scroll to ensure cinematic sequence plays smoothly
window.addEventListener('wheel', (e) => {
    if (isCinematicScrolling) {
        e.preventDefault();
        return;
    }

    const sMax = scrollEl.scrollHeight - window.innerHeight;
    if (sMax <= 0) return;

    const currentProg = window.scrollY / sMax;
    let nextProg;

    if (e.deltaY > 0) {
        nextProg = CINEMATIC_CONFIG.milestones.find(m => m > currentProg + 0.01);
    } else if (e.deltaY < 0) {
        nextProg = [...CINEMATIC_CONFIG.milestones].reverse().find(m => m < currentProg - 0.01);
    }

    if (nextProg !== undefined) {
        e.preventDefault();
        triggerCinematicScroll(nextProg);
    }
}, { passive: false });

// ── Mobile Touch Support ──────────────────────────
let touchStartY = 0;
window.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
}, { passive: true });

window.addEventListener('touchmove', (e) => {
    // 애니메이션 진행 중에는 터치 스크롤 방지
    if (isCinematicScrolling) e.preventDefault();
}, { passive: false });

window.addEventListener('touchend', (e) => {
    if (isCinematicScrolling) return;

    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchStartY - touchEndY; // 양수: 상단으로 밀기 (아래로 스크롤)

    // 아주 짧은 터치는 무시
    if (Math.abs(deltaY) < 40) return;

    const sMax = scrollEl.scrollHeight - window.innerHeight;
    if (sMax <= 0) return;

    const currentProg = window.scrollY / sMax;
    let nextProg;

    if (deltaY > 0) {
        nextProg = CINEMATIC_CONFIG.milestones.find(m => m > currentProg + 0.01);
    } else {
        nextProg = [...CINEMATIC_CONFIG.milestones].reverse().find(m => m < currentProg - 0.01);
    }

    if (nextProg !== undefined) {
        triggerCinematicScroll(nextProg);
    }
}, { passive: true });

// Make scroll hint clickable
scrollHint?.addEventListener('click', () => {
    // 첫 번째 주요 장면(50%)으로 이동
    triggerCinematicScroll(CINEMATIC_CONFIG.milestones[1]);
});

// ── Scroll-hint fade on first scroll ─────────────
window.addEventListener('scroll', () => {
    if (scrollHint && window.scrollY > 30) {
        scrollHint.style.opacity = '0';
        scrollHint.style.pointerEvents = 'none';
        scrollHint.style.transition = 'opacity 0.8s ease';
    } else if (scrollHint && window.scrollY < 10) {
        scrollHint.style.opacity = '1';
        scrollHint.style.pointerEvents = 'auto';
    }
}, { passive: true });

// ── Milestone Navigation Mapping ──────────────────
const SECTION_MIL_MAP = {
    '#about-section': 2,    // 63%
    '#features-section': 3, // 75%
    '#rules-section': 4,    // 87%
    '#join-section': 5      // 100%
};

document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
        const href = a.getAttribute('href');
        const milIndex = SECTION_MIL_MAP[href];

        // 만약 마일스톤에 매핑된 버튼이라면 시네마틱 스크롤 실행
        if (milIndex !== undefined) {
            e.preventDefault();
            triggerCinematicScroll(CINEMATIC_CONFIG.milestones[milIndex]);
        } else if (href === '#gathering-section') {
            e.preventDefault();
            triggerCinematicScroll(CINEMATIC_CONFIG.milestones[1]); // 50%
        } else if (href === '#hero-section') {
            e.preventDefault();
            triggerCinematicScroll(0);
        }
    });
});

// ── Keyboard accessibility for CTA ───────────────
document.getElementById('main-cta-btn')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') e.currentTarget.click();
});

// ── Boot ─────────────────────────────────────────
rafId = requestAnimationFrame(t => { lastTime = t; tick(t); });
