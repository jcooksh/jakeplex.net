import { useEffect, useRef } from 'react'
import { createNoise2D } from 'simplex-noise'

export function Waves({
    className = "",
    strokeColor = "#ffffff",
    backgroundColor = "#000000",
    pointerSize = 0.5,
}) {
    const containerRef = useRef(null)
    const canvasRef = useRef(null)

    useEffect(() => {
        const container = containerRef.current
        const canvas = canvasRef.current
        if (!container || !canvas) return

        const ctx = canvas.getContext('2d')
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const noise = createNoise2D()
        const mouse = { x: -10, y: 0, lx: 0, ly: 0, sx: 0, sy: 0, v: 0, vs: 0, a: 0, set: false }
        let lines = []
        let ripples = []
        let bounding = null
        let rafId = null

        const setSize = () => {
            bounding = container.getBoundingClientRect()
            const { width, height } = bounding
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            canvas.width = Math.round(width * dpr)
            canvas.height = Math.round(height * dpr)
            canvas.style.width = `${width}px`
            canvas.style.height = `${height}px`
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        }

        const setLines = () => {
            const { width, height } = bounding
            lines = []

            // Same line density as the old SVG version (xGap); yGap only affects
            // sampling along each line, where 12px is visually indistinguishable from 8px
            const xGap = 8
            const yGap = 12
            const oWidth = width + 200
            const oHeight = height + 30
            const totalLines = Math.ceil(oWidth / xGap)
            const totalPoints = Math.ceil(oHeight / yGap)
            const xStart = (width - xGap * totalLines) / 2
            const yStart = (height - yGap * totalPoints) / 2

            for (let i = 0; i < totalLines; i++) {
                const points = []
                for (let j = 0; j < totalPoints; j++) {
                    points.push({
                        x: xStart + xGap * i,
                        y: yStart + yGap * j,
                        wave: { x: 0, y: 0 },
                        cursor: { x: 0, y: 0, vx: 0, vy: 0 },
                    })
                }
                lines.push(points)
            }
        }

        const updateMousePosition = (x, y) => {
            if (!bounding) return
            mouse.x = x - bounding.left
            mouse.y = y - bounding.top + window.scrollY
            if (!mouse.set) {
                mouse.sx = mouse.x; mouse.sy = mouse.y
                mouse.lx = mouse.x; mouse.ly = mouse.y
                mouse.set = true
            }
            container.style.setProperty('--x', `${mouse.sx}px`)
            container.style.setProperty('--y', `${mouse.sy}px`)
        }

        const onResize = () => { setSize(); setLines() }
        const onMouseMove = (e) => updateMousePosition(e.pageX, e.pageY)
        const onTouchMove = (e) => {
            e.preventDefault()
            const touch = e.touches[0]
            updateMousePosition(touch.clientX, touch.clientY)
        }
        const onClickRipple = (e) => {
            if (!bounding) return
            ripples.push({
                x: e.clientX - bounding.left,
                y: e.clientY - bounding.top,
                radius: 0,
                maxRadius: 250,
                strength: 40,
                born: performance.now(),
            })
        }

        const movePoints = (time) => {
            const now = performance.now()

            for (const r of ripples) {
                const age = (now - r.born) / 1000
                r.radius = age * 800
            }
            ripples = ripples.filter(r => r.radius < r.maxRadius + 60)
            const hasCursor = mouse.set

            for (const points of lines) {
                for (const p of points) {
                    const move = noise((p.x + time * 0.008) * 0.003, (p.y + time * 0.003) * 0.002) * 8
                    p.wave.x = Math.cos(move) * 12
                    p.wave.y = Math.sin(move) * 6

                    if (hasCursor) {
                        const dx = p.x - mouse.sx
                        const dy = p.y - mouse.sy
                        const d = Math.hypot(dx, dy)
                        const l = Math.max(175, mouse.vs)

                        if (d < l) {
                            const s = 1 - d / l
                            const f = Math.cos(d * 0.001) * s
                            p.cursor.vx += Math.cos(mouse.a) * f * l * mouse.vs * 0.00035
                            p.cursor.vy += Math.sin(mouse.a) * f * l * mouse.vs * 0.00035
                        }
                    }

                    for (const r of ripples) {
                        const rdx = p.x - r.x
                        const rdy = p.y - r.y
                        const rd = Math.hypot(rdx, rdy)
                        const ringWidth = 60
                        const dist = Math.abs(rd - r.radius)
                        if (dist < ringWidth) {
                            const falloff = (1 - dist / ringWidth) * (1 - r.radius / r.maxRadius)
                            const angle = Math.atan2(rdy, rdx)
                            p.cursor.vx += Math.cos(angle) * falloff * r.strength * 0.06
                            p.cursor.vy += Math.sin(angle) * falloff * r.strength * 0.06
                        }
                    }

                    p.cursor.vx += (0 - p.cursor.x) * 0.01
                    p.cursor.vy += (0 - p.cursor.y) * 0.01
                    p.cursor.vx *= 0.95
                    p.cursor.vy *= 0.95
                    p.cursor.x += p.cursor.vx
                    p.cursor.y += p.cursor.vy
                    p.cursor.x = Math.min(50, Math.max(-50, p.cursor.x))
                    p.cursor.y = Math.min(50, Math.max(-50, p.cursor.y))
                }
            }
        }

        const drawLines = () => {
            const { width, height } = bounding
            ctx.clearRect(0, 0, width, height)
            ctx.beginPath()
            ctx.strokeStyle = strokeColor
            ctx.lineWidth = 1

            for (const points of lines) {
                if (points.length < 2) continue
                const first = points[0]
                ctx.moveTo(first.x + first.wave.x, first.y + first.wave.y)
                for (let i = 1; i < points.length; i++) {
                    const p = points[i]
                    ctx.lineTo(p.x + p.wave.x + p.cursor.x, p.y + p.wave.y + p.cursor.y)
                }
            }
            ctx.stroke()
        }

        const tick = (time) => {
            mouse.sx += (mouse.x - mouse.sx) * 0.1
            mouse.sy += (mouse.y - mouse.sy) * 0.1

            const dx = mouse.x - mouse.lx
            const dy = mouse.y - mouse.ly
            const d = Math.hypot(dx, dy)
            mouse.v = d
            mouse.vs += (d - mouse.vs) * 0.1
            mouse.vs = Math.min(100, mouse.vs)
            mouse.lx = mouse.x
            mouse.ly = mouse.y
            mouse.a = Math.atan2(dy, dx)

            container.style.setProperty('--x', `${mouse.sx}px`)
            container.style.setProperty('--y', `${mouse.sy}px`)

            movePoints(time)
            drawLines()
            rafId = requestAnimationFrame(tick)
        }

        setSize()
        setLines()

        window.addEventListener('resize', onResize)
        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('click', onClickRipple)
        container.addEventListener('touchmove', onTouchMove, { passive: false })

        if (reducedMotion) {
            // Single static frame, no animation loop
            movePoints(0)
            drawLines()
        } else {
            rafId = requestAnimationFrame(tick)
        }

        return () => {
            if (rafId) cancelAnimationFrame(rafId)
            window.removeEventListener('resize', onResize)
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('click', onClickRipple)
            container.removeEventListener('touchmove', onTouchMove)
        }
    }, [strokeColor])

    return (
        <div
            ref={containerRef}
            className={`waves-component ${className}`}
            style={{
                backgroundColor,
                position: 'absolute',
                top: 0, left: 0,
                margin: 0, padding: 0,
                width: '100%', height: '100%',
                overflow: 'hidden',
                zIndex: 0,
            }}
        >
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
            {pointerSize > 0 && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0, left: 0,
                        width: `${pointerSize}rem`,
                        height: `${pointerSize}rem`,
                        background: strokeColor,
                        borderRadius: '50%',
                        transform: 'translate3d(calc(var(--x) - 50%), calc(var(--y) - 50%), 0)',
                        willChange: 'transform',
                    }}
                />
            )}
        </div>
    )
}
