import { useEffect, useRef } from 'react';

// Geometry lifted from the original 36-gradient framer-motion version: one
// stream per 25px column — [tileHeight, startOffset, pxTravelledPer150s]
const STREAMS = [
	[235, 220, 6580], [252, 24, 13608], [150, 16, 5400], [253, 224, 16951],
	[204, 19, 5100], [134, 120, 8308], [179, 31, 9845], [299, 235, 13156],
	[215, 121, 14620], [281, 224, 18546], [158, 26, 5056], [210, 75, 6300],
];
const COLUMN_GAP = 25;
// The canvas renders at 1/8 resolution and is upscaled by the browser — the
// smoothing stands in for the old full-screen backdrop-filter blur, which
// re-blurred the entire viewport every animation frame.
const SCALE = 8;

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
		const ctx = canvas.getContext('2d');
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		let rafId = null;
		let w = 0, h = 0;

		// Pre-render one soft streak sprite; per-frame work is just drawImage calls
		const streakH = Math.ceil(200 / SCALE);
		const fade = color.length === 7 ? `${color}00` : 'rgba(0,0,0,0)';
		const sprite = document.createElement('canvas');
		sprite.width = 2;
		sprite.height = streakH;
		const sctx = sprite.getContext('2d');
		const grad = sctx.createLinearGradient(0, 0, 0, streakH);
		grad.addColorStop(0, fade);
		grad.addColorStop(0.5, color);
		grad.addColorStop(1, fade);
		sctx.fillStyle = grad;
		sctx.fillRect(0, 0, 2, streakH);

		// Vignette baked into the canvas (alpha 1 centre → 0 at 80%, matching the old
		// CSS mask-image ellipse). Erasing in-canvas is ~free; the CSS mask forced the
		// compositor to re-render a full-screen offscreen surface every frame.
		let vignette = null;
		const buildVignette = () => {
			vignette = document.createElement('canvas');
			vignette.width = w;
			vignette.height = h;
			const vctx = vignette.getContext('2d');
			const cx = w / 2, cy = h / 2;
			const rx = cx * Math.SQRT2;
			vctx.translate(cx, cy);
			vctx.scale(1, h / w);
			const grad = vctx.createRadialGradient(0, 0, 0, 0, 0, rx);
			grad.addColorStop(0, 'rgba(0,0,0,1)');
			grad.addColorStop(0.8, 'rgba(0,0,0,0)');
			vctx.fillStyle = grad;
			vctx.fillRect(-cx, (-cy * w) / h, w, (h * w) / h);
		};

		const resize = () => {
			const rect = canvas.getBoundingClientRect();
			w = Math.max(1, Math.round(rect.width / SCALE));
			h = Math.max(1, Math.round(rect.height / SCALE));
			canvas.width = w;
			canvas.height = h;
			buildVignette();
		};

		const draw = (now) => {
			const t = now / 1000;
			ctx.fillStyle = backgroundColor;
			ctx.fillRect(0, 0, w, h);
			const cols = Math.ceil((w * SCALE) / COLUMN_GAP);
			for (let c = 0; c <= cols; c++) {
				const [tileH, startY, travel] = STREAMS[c % STREAMS.length];
				const speed = travel / duration;
				const x = (c * COLUMN_GAP + 1.5) / SCALE - 1;
				const tile = tileH / SCALE;
				const offset = ((((startY + t * speed) / SCALE) % tile) + tile) % tile;
				for (let y = offset - tile - streakH; y < h; y += tile) {
					ctx.drawImage(sprite, x, y);
				}
			}
			ctx.globalCompositeOperation = 'destination-out';
			ctx.drawImage(vignette, 0, 0);
			ctx.globalCompositeOperation = 'source-over';
		};

		// 20fps: fastest stream moves <1 canvas px per frame; the 8x upscale
		// smoothing hides the steps entirely while compositing cost drops to 1/3.
		let lastDraw = 0;
		const tick = (now) => {
			rafId = requestAnimationFrame(tick);
			if (now - lastDraw < 50) return;
			lastDraw = now;
			draw(now);
		};

		const pause = () => { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } };
		const resume = () => { if (!rafId && !reducedMotion) rafId = requestAnimationFrame(tick); };

		resize();
		window.addEventListener('resize', resize);
		if (reducedMotion) {
			draw(0);
		} else {
			rafId = requestAnimationFrame(tick);
			window.addEventListener('blur', pause);
			window.addEventListener('focus', resume);
		}

		return () => {
			if (rafId) cancelAnimationFrame(rafId);
			window.removeEventListener('resize', resize);
			window.removeEventListener('blur', pause);
			window.removeEventListener('focus', resume);
		};
	}, [color, backgroundColor, duration]);

	return (
		<div style={{ position: 'relative', height: '100%', width: '100%', backgroundColor, animation: 'fadeIn 0.2s ease', ...style }}>
			<canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
			<div
				style={{
					position: 'absolute',
					inset: 0,
					backgroundImage: `radial-gradient(circle at 50% 50%, transparent 0, transparent 2px, ${backgroundColor} 2px)`,
					backgroundSize: `${8 * density}px ${8 * density}px`,
				}}
			/>
		</div>
	);
}
