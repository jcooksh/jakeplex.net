import React, { useEffect, useRef } from 'react';

const CircularGallery = React.forwardRef(
    ({ items, className = '', radius = 600, autoRotateSpeed = 0.02, ...props }, ref) => {
        const ringRef = useRef(null);
        const itemRefs = useRef([]);
        const rotationRef = useRef(0);
        const scrollRotationRef = useRef(0);
        const isScrollingRef = useRef(false);
        const scrollTimeoutRef = useRef(null);
        const animationFrameRef = useRef(null);

        const anglePerItem = 360 / items.length;

        useEffect(() => {
            const handleScroll = () => {
                isScrollingRef.current = true;
                if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

                const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
                const scrollProgress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
                scrollRotationRef.current = scrollProgress * 360;

                scrollTimeoutRef.current = setTimeout(() => { isScrollingRef.current = false; }, 150);
            };

            window.addEventListener('scroll', handleScroll, { passive: true });
            return () => {
                window.removeEventListener('scroll', handleScroll);
                if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
            };
        }, []);

        useEffect(() => {
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            itemRefs.current.length = items.length;

            // Rotation and per-item opacity are driven imperatively each frame:
            // React state here would re-render the whole ring 60x/s.
            const apply = () => {
                const rotation = rotationRef.current + scrollRotationRef.current;
                if (ringRef.current) {
                    ringRef.current.style.transform = `rotateY(${rotation}deg)`;
                }
                const totalRotation = ((rotation % 360) + 360) % 360;
                itemRefs.current.forEach((el, i) => {
                    if (!el) return;
                    const relativeAngle = (i * anglePerItem + totalRotation + 360) % 360;
                    const normalizedAngle = Math.abs(relativeAngle > 180 ? 360 - relativeAngle : relativeAngle);
                    el.style.opacity = Math.max(0.25, 1 - normalizedAngle / 180);
                });
            };

            apply();
            if (reducedMotion) return;

            // 30fps, time-based: rotation is ~2deg/s, so half-rate steps are invisible
            let last = 0;
            const autoRotate = (now) => {
                animationFrameRef.current = requestAnimationFrame(autoRotate);
                if (now - last < 33) return;
                const k = last ? Math.min((now - last) / 16.7, 4) : 1;
                last = now;
                if (!isScrollingRef.current) rotationRef.current += autoRotateSpeed * k;
                apply();
            };
            const pause = () => {
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                    animationFrameRef.current = null;
                }
            };
            const resume = () => {
                if (!animationFrameRef.current) {
                    last = 0;
                    animationFrameRef.current = requestAnimationFrame(autoRotate);
                }
            };
            animationFrameRef.current = requestAnimationFrame(autoRotate);
            window.addEventListener('blur', pause);
            window.addEventListener('focus', resume);
            return () => {
                pause();
                window.removeEventListener('blur', pause);
                window.removeEventListener('focus', resume);
            };
        }, [autoRotateSpeed, anglePerItem, items.length]);

        return (
            <div
                ref={ref}
                role="region"
                aria-label="Circular Movie Gallery"
                className={className}
                style={{ perspective: '2000px', position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                {...props}
            >
                <div
                    ref={ringRef}
                    style={{
                        position: 'relative', width: '100%', height: '100%',
                        transformStyle: 'preserve-3d',
                        willChange: 'transform',
                    }}
                >
                    {items.map((item, i) => {
                        const itemAngle = i * anglePerItem;

                        return (
                            <div
                                key={item.poster}
                                ref={(el) => { itemRefs.current[i] = el; }}
                                role="group"
                                aria-label={item.title}
                                style={{
                                    position: 'absolute',
                                    width: '110px', height: '165px',
                                    transform: `rotateY(${itemAngle}deg) translateZ(${radius}px)`,
                                    left: '50%', top: '50%',
                                    marginLeft: '-55px', marginTop: '-82px',
                                }}
                            >
                                <div style={{
                                    position: 'relative', width: '100%', height: '100%',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(139,92,246,0.15)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    background: 'rgba(8,11,24,0.8)',
                                }}>
                                    <img
                                        src={item.poster}
                                        alt={item.title}
                                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                                        loading="lazy"
                                    />
                                    <div style={{
                                        position: 'absolute', bottom: 0, left: 0, width: '100%',
                                        padding: '20px 8px 8px',
                                        background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, transparent 100%)',
                                        color: '#fff',
                                    }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.65rem', lineHeight: 1.2, marginBottom: '2px' }}>{item.title}</div>
                                        <div style={{ fontSize: '0.55rem', opacity: 0.6 }}>{item.year} · {item.genre}</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
);

CircularGallery.displayName = 'CircularGallery';
export { CircularGallery };
