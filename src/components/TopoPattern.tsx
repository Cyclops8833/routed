import { useId } from 'react'

export default function TopoPattern({ className = '' }: { className?: string }) {
  const uid = useId().replace(/:/g, '')
  const filterId = `topo-turbulence-${uid}`

  return (
    <svg
      className={`topo-pattern ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 800 800"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <defs>
        <filter id={filterId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" seed="42" result="noise"/>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="12" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
      <g filter={`url(#${filterId})`} className="topo-lines">
        <path d="M 400 60 C 600 40, 760 180, 740 400 C 720 580, 580 740, 400 730 C 220 720, 50 580, 60 400 C 70 220, 200 80, 400 60 Z" fill="none" strokeWidth="0.6" className="topo-line" opacity="0.03"/>
        <path d="M 400 100 C 580 85, 710 200, 700 400 C 690 570, 560 700, 400 690 C 240 680, 100 560, 105 400 C 110 240, 230 115, 400 100 Z" fill="none" strokeWidth="0.8" className="topo-line" opacity="0.04"/>
        <path d="M 400 145 C 555 130, 660 230, 655 400 C 650 555, 540 655, 400 648 C 262 641, 148 542, 150 400 C 152 260, 252 158, 400 145 Z" fill="none" strokeWidth="0.9" className="topo-line" opacity="0.045"/>
        <path d="M 400 190 C 530 178, 610 262, 608 400 C 606 528, 520 610, 400 605 C 282 600, 196 522, 195 400 C 194 280, 276 200, 400 190 Z" fill="none" strokeWidth="1.0" className="topo-line" opacity="0.05"/>
        <path d="M 400 230 C 506 220, 565 294, 563 400 C 561 502, 498 563, 400 560 C 304 557, 240 498, 239 400 C 238 304, 298 238, 400 230 Z" fill="none" strokeWidth="1.1" className="topo-line" opacity="0.055"/>
        <path d="M 400 270 C 478 262, 518 325, 517 400 C 516 472, 472 515, 400 513 C 330 511, 285 470, 284 400 C 283 330, 324 276, 400 270 Z" fill="none" strokeWidth="1.1" className="topo-line" opacity="0.06"/>
        <path d="M 400 308 C 452 302, 482 349, 481 400 C 480 448, 448 480, 400 479 C 354 478, 321 448, 320 400 C 319 354, 350 313, 400 308 Z" fill="none" strokeWidth="1.2" className="topo-line" opacity="0.065"/>
        <path d="M 400 342 C 432 337, 453 365, 452 400 C 451 433, 430 454, 400 453 C 372 452, 350 432, 349 400 C 348 370, 370 346, 400 342 Z" fill="none" strokeWidth="1.2" className="topo-line" opacity="0.07"/>
        <path d="M 400 370 C 420 366, 432 382, 431 400 C 430 417, 418 430, 400 429 C 384 428, 370 416, 369 400 C 368 385, 382 373, 400 370 Z" fill="none" strokeWidth="1.3" className="topo-line" opacity="0.075"/>
        <path d="M 400 392 C 408 390, 413 395, 412 400 C 411 405, 407 410, 400 409 C 394 408, 389 404, 388 400 C 387 396, 393 393, 400 392 Z" fill="none" strokeWidth="1.5" className="topo-line" opacity="0.08"/>
      </g>
    </svg>
  )
}
