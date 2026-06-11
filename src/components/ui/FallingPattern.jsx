import { useEffect, useRef } from 'react';

// Geometry lifted from the original 36-gradient framer-motion version: one
// stream per 25px column — [tileHeight, startOffset, pxTravelledPer150s]
const STREAMS = [
	[235, 220, 6580], [252, 24, 13608], [150, 16, 5400], [253, 224, 16951],
	[204, 19, 5100], [134, 120, 8308], [179, 31, 9845], [299, 235, 13156],
	[215, 121, 14620], [281, 224, 18546], [158, 26, 5056], [210, 75, 6300],
];
const COLUMN_GAP = 25;
// The streaks are still authored at 1/8 resolution and upscaled once into a
// sprite — the smoothing stands in for the old full-screen backdrop blur.
const SCALE = 8;

// Unified background renderer: streaks + LED dot mask + vignette + stars +
// page scrim all drawn into ONE opaque canvas. Previously these were five
// stacked full-screen surfaces (streak canvas, dot-mask div, starfield canvas,
// scrim ::before, wrapper bg) that the compositor re-blended on every frame of
// two out-of-phase clocks. One opaque layer also occlusion-culls everything
// beneath it.
export function FallingPattern({
	color = '#8b5cf6',
	backgroundColor = '#04060f',
	duration = 150,
	density = 1,
	style,
}) {
	const canvasRef = useRef(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d', { alpha: false });
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		let rafId = null;
		let w = 0, h = 0; // CSS px
		let dpr = 1;

		const fade = color.length === 7 ? `${color}00` : 'rgba(0,0,0,0)';
		const bgAlpha = (a) => {
			// backgroundColor is a 6-digit hex (#04060f) — derive rgba() stops for gradients
			const r = parseInt(backgroundColor.slice(1, 3), 16);
			const g = parseInt(backgroundColor.slice(3, 5), 16);
			const b = parseInt(backgroundColor.slice(5, 7), 16);
			return `rgba(${r},${g},${b},${a})`;
		};

		// --- sprites & gradients (rebuilt on resize/dpr change) ---
		let streakSprite = null, dotTile = null, dotPattern = null, vignGrad = null, scrimGrad = null;
		let stars = [];

		const buildStreakSprite = () => {
			// author at 1/8 res, upscale once — same soft look as the old upscaled canvas
			const lo = document.createElement('canvas');
			lo.width = 2;
			lo.height = Math.ceil(200 / SCALE);
			const lctx = lo.getContext('2d');
			const grad = lctx.createLinearGradient(0, 0, 0, lo.height);
			grad.addColorStop(0, fade);
			grad.addColorStop(0.5, color);
			grad.addColorStop(1, fade);
			lctx.fillStyle = grad;
			lctx.fillRect(0, 0, lo.width, lo.height);

			streakSprite = document.createElement('canvas');
			streakSprite.width = 2 * SCALE * dpr;
			streakSprite.height = 200 * dpr;
			const sctx = streakSprite.getContext('2d');
			sctx.imageSmoothingEnabled = true;
			sctx.imageSmoothingQuality = 'high';
			sctx.drawImage(lo, 0, 0, streakSprite.width, streakSprite.height);
		};

		const buildDotTile = () => {
			// device-res tile: backgroundColor sheet with a crisp transparent hole,
			// identical to the old radial-gradient dot-mask div
			const size = Math.round(8 * density * dpr);
			dotTile = document.createElement('canvas');
			dotTile.width = size;
			dotTile.height = size;
			const dctx = dotTile.getContext('2d');
			dctx.fillStyle = backgroundColor;
			dctx.fillRect(0, 0, size, size);
			dctx.globalCompositeOperation = 'destination-out';
			dctx.beginPath();
			dctx.arc(size / 2, size / 2, 2 * dpr, 0, Math.PI * 2);
			dctx.fill();
			dotPattern = ctx.createPattern(dotTile, 'repeat');
		};

		const buildGradients = () => {
			// vignette: hides the pattern toward the centre — same geometry as the
			// old mask-image ellipse (alpha 1 at centre fading out at 80%)
			const vg = document.createElement('canvas');
			vg.width = Math.max(1, Math.round(w / 2));
			vg.height = Math.max(1, Math.round(h / 2));
			const vctx = vg.getContext('2d');
			const vcx = vg.width / 2, vcy = vg.height / 2;
			const vrx = vcx * Math.SQRT2;
			vctx.translate(vcx, vcy);
			vctx.scale(1, vg.height / vg.width);
			const vgrad = vctx.createRadialGradient(0, 0, 0, 0, 0, vrx);
			vgrad.addColorStop(0, bgAlpha(1));
			vgrad.addColorStop(0.8, bgAlpha(0));
			vctx.fillStyle = vgrad;
			vctx.fillRect(-vcx, (-vcy * vg.width) / vg.height, vg.width, vg.width);
			vignGrad = vg;

			// scrim: replicates the old .page::before —
			// radial-gradient(ellipse 75% 70% at 50% 38%, bg .88 0%, bg .35 60%, transparent 100%)
			const sg = document.createElement('canvas');
			sg.width = vg.width;
			sg.height = vg.height;
			const sctx = sg.getContext('2d');
			const scx = sg.width * 0.5, scy = sg.height * 0.38;
			const srx = sg.width * 0.75, sry = sg.height * 0.70;
			sctx.translate(scx, scy);
			sctx.scale(1, sry / srx);
			const sgrad = sctx.createRadialGradient(0, 0, 0, 0, 0, srx);
			sgrad.addColorStop(0, bgAlpha(0.88));
			sgrad.addColorStop(0.6, bgAlpha(0.35));
			sgrad.addColorStop(1, bgAlpha(0));
			sctx.fillStyle = sgrad;
			sctx.fillRect(-scx, (-scy * srx) / sry, sg.width, (sg.height * srx) / sry);
			scrimGrad = sg;
		};

		const seedStars = () => {
			// same population as the old standalone starfield canvas
			const count = w < 768 ? 110 : 220;
			stars = [];
			for (let i = 0; i < count; i++) {
				stars.push({
					x: Math.random() * w,
					y: Math.random() * h,
					r: Math.random() * 1.4 + 0.15,
					base: Math.random() * 0.7 + 0.1,
					speed: Math.random() * 0.04 + 0.01,
					ts: Math.random() * Math.PI * 2,
					tsp: Math.random() * 0.015 + 0.003,
					hue: Math.random() < 0.5 ? 260 : 185,
					col: Math.random() < 0.15,
				});
			}
		};

		const resize = () => {
			const rect = canvas.getBoundingClientRect();
			w = Math.max(1, Math.round(rect.width));
			h = Math.max(1, Math.round(rect.height));
			dpr = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = Math.round(w * dpr);
			canvas.height = Math.round(h * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			buildStreakSprite();
			buildDotTile();
			buildGradients();
			seedStars();
			// Setting canvas.width clears the bitmap to black — if no loop is
			// running (reduced motion, blurred, or calm) nothing would repaint it.
			if (!rafId) draw(reducedMotion ? 0 : performance.now() - timeOffset, 1);
		};

		let starT = 0;
		const draw = (now, k) => {
			const t = now / 1000;

			// 1. base
			ctx.fillStyle = backgroundColor;
			ctx.fillRect(0, 0, w, h);

			// 2. falling streaks
			const cols = Math.ceil(w / COLUMN_GAP);
			const spriteW = 2 * SCALE, spriteH = 200;
			for (let c = 0; c <= cols; c++) {
				const [tileH, startY, travel] = STREAMS[c % STREAMS.length];
				const speed = travel / duration;
				const x = c * COLUMN_GAP + 1.5 - spriteW / 2;
				const offset = (((startY + t * speed) % tileH) + tileH) % tileH;
				for (let y = offset - tileH * Math.ceil(spriteH / tileH); y < h; y += tileH) {
					ctx.drawImage(streakSprite, x, y, spriteW, spriteH);
				}
			}

			// 3. LED dot mask (crisp, device-res pattern)
			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.fillStyle = dotPattern;
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.restore();

			// 4. centre vignette
			ctx.drawImage(vignGrad, 0, 0, w, h);

			// 5. stars (above the dots, like the old separate starfield canvas)
			starT += 0.008 * k;
			for (const s of stars) {
				const op = s.base * (0.5 + 0.5 * Math.sin(starT * s.tsp * 60 + s.ts));
				ctx.fillStyle = s.col ? `hsla(${s.hue},80%,80%,${op})` : `rgba(255,255,255,${op})`;
				ctx.beginPath();
				ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
				ctx.fill();
				s.y -= s.speed * k;
				if (s.y < -2) { s.y = h + 2; s.x = Math.random() * w; }
			}

			// 6. content scrim (replaces .page::before)
			ctx.drawImage(scrimGrad, 0, 0, w, h);
		};

		// 20fps: fastest stream steps ~6 screen px per 50ms frame; soft streaks +
		// dot mask hide the steps entirely while compositing cost drops to 1/3.
		// timeOffset freezes the animation clock across pause/resume so streaks
		// don't visibly jump phase right when the user re-engages after calm.
		let lastDraw = 0;
		let timeOffset = 0;
		let pausedAt = 0;
		const tick = (now) => {
			rafId = requestAnimationFrame(tick);
			if (lastDraw && now - lastDraw < 50) return;
			const k = lastDraw ? Math.min((now - lastDraw) / 16.7, 8) : 1;
			lastDraw = now;
			draw(now - timeOffset, k);
		};

		const pause = () => {
			if (rafId) {
				cancelAnimationFrame(rafId);
				rafId = null;
				pausedAt = performance.now();
			}
		};
		// app-calm check: a bare focus event must not restart the loop while the
		// page is idle-calm — CalmGovernor treats refocus as activity and fires
		// 'jp:active' immediately after removing the class.
		const resume = () => {
			if (!rafId && !reducedMotion && !document.body.classList.contains('app-calm')) {
				if (pausedAt) {
					timeOffset += performance.now() - pausedAt;
					pausedAt = 0;
				}
				lastDraw = 0;
				rafId = requestAnimationFrame(tick);
			}
		};

		resize();
		window.addEventListener('resize', resize);
		if (reducedMotion) {
			draw(0, 1);
		} else {
			rafId = requestAnimationFrame(tick);
			window.addEventListener('blur', pause);
			window.addEventListener('focus', resume);
			window.addEventListener('jp:calm', pause);
			window.addEventListener('jp:active', resume);
		}

		return () => {
			if (rafId) cancelAnimationFrame(rafId);
			window.removeEventListener('resize', resize);
			window.removeEventListener('blur', pause);
			window.removeEventListener('focus', resume);
			window.removeEventListener('jp:calm', pause);
			window.removeEventListener('jp:active', resume);
		};
	}, [color, backgroundColor, duration, density]);

	return (
		<div style={{ position: 'relative', height: '100%', width: '100%', backgroundColor, animation: 'fadeIn 0.2s ease', ...style }}>
			<canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
		</div>
	);
}
