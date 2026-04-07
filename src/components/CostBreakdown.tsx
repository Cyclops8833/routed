import { useState, useEffect, useRef } from 'react'
import type { CostBreakdown as CostBreakdownData, FuelPrices, MemberCost } from '../utils/costEngine'

interface CostBreakdownProps {
  breakdown: CostBreakdownData
  maxBudget: number
  onUpdateFuelPrices?: (prices: FuelPrices) => void
  onUpdateFoodRate?: (rate: number) => void
  editable?: boolean
  nights: number
  fuelPrices: FuelPrices
  dailyFoodRate: number
  priceIsEstimated?: boolean
}

function useCountUp(target: number, duration: number, active: boolean): number {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active) return
    const start = Date.now()

    function tick() {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      setValue(target * progress)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setValue(target)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration, active])

  return value
}

type Segment = 'fuel' | 'camp' | 'food' | 'other'

const SEGMENT_META: Record<Segment, { label: string; color: string; key: keyof MemberCost }> = {
  fuel:  { label: 'Fuel',  color: '#4A6741', key: 'fuelCost' },
  camp:  { label: 'Camp',  color: '#C4893B', key: 'campsiteCost' },
  food:  { label: 'Food',  color: '#B85C38', key: 'foodCost' },
  other: { label: 'Other', color: '#8C8578', key: 'otherCost' },
}

function MemberBar({
  member,
  maxTotal,
  mounted,
  index,
}: {
  member: MemberCost
  maxTotal: number
  mounted: boolean
  index: number
}) {
  const [activeSeg, setActiveSeg] = useState<Segment | null>(null)

  const pct = (cost: number) => (maxTotal > 0 ? (cost / maxTotal) * 100 : 0)

  const animatedTotal = useCountUp(member.total, 800, mounted)

  const segments: Array<{ seg: Segment; width: number }> = [
    { seg: 'fuel',  width: pct(member.fuelCost) },
    { seg: 'camp',  width: pct(member.campsiteCost) },
    { seg: 'food',  width: pct(member.foodCost) },
    { seg: 'other', width: pct(member.otherCost) },
  ]

  return (
    <div
      className="card-animate"
      style={{ marginBottom: '12px', animationDelay: `${index * 60}ms` }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '4px',
        }}
      >
        <span
          style={{
            fontFamily: 'DM Sans, system-ui, sans-serif',
            fontSize: '14px',
            color: member.overBudget ? '#E07A5F' : 'var(--color-charcoal)',
            fontWeight: member.overBudget ? '600' : '400',
          }}
        >
          {member.displayName}
          {member.overBudget && (
            <span
              style={{
                marginLeft: '6px',
                fontSize: '12px',
                color: '#E07A5F',
                fontWeight: '500',
              }}
            >
              ↑ over budget
            </span>
          )}
        </span>
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '14px',
            fontWeight: '700',
            color: member.overBudget ? '#E07A5F' : 'var(--color-charcoal)',
          }}
        >
          ${Math.round(animatedTotal)}
        </span>
      </div>

      {/* Segmented bar — each segment is tappable */}
      <div
        style={{
          height: '14px',
          borderRadius: '7px',
          overflow: 'hidden',
          background: 'rgba(140,133,120,0.12)',
          display: 'flex',
          cursor: 'pointer',
        }}
      >
        {segments.map(({ seg, width }) => (
          <div
            key={seg}
            onClick={() => setActiveSeg(activeSeg === seg ? null : seg)}
            title={SEGMENT_META[seg].label}
            style={{
              width: mounted ? `${width}%` : '0%',
              height: '100%',
              backgroundColor: SEGMENT_META[seg].color,
              transition: 'width 600ms ease-out',
              flexShrink: 0,
              opacity: activeSeg && activeSeg !== seg ? 0.45 : 1,
            }}
          />
        ))}
      </div>

      {/* Inline detail row — shown when a segment is active */}
      {activeSeg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '5px',
            paddingLeft: '2px',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: SEGMENT_META[activeSeg].color,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: 'DM Sans, system-ui, sans-serif',
              fontSize: '12px',
              color: 'var(--color-stone)',
            }}
          >
            {SEGMENT_META[activeSeg].label}
          </span>
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '12px',
              fontWeight: '700',
              color: SEGMENT_META[activeSeg].color,
              marginLeft: '2px',
            }}
          >
            ${Math.round(member[SEGMENT_META[activeSeg].key] as number)}
          </span>
        </div>
      )}
    </div>
  )
}

export default function CostBreakdown({
  breakdown,
  maxBudget,
  onUpdateFuelPrices,
  onUpdateFoodRate,
  editable = false,
  nights,
  fuelPrices,
  dailyFoodRate,
  priceIsEstimated = false,
}: CostBreakdownProps) {
  const [mounted, setMounted] = useState(false)
  const [localPetrol, setLocalPetrol] = useState(String(fuelPrices.petrol))
  const [localDiesel, setLocalDiesel] = useState(String(fuelPrices.diesel))
  const [localFoodRate, setLocalFoodRate] = useState(String(dailyFoodRate))
  const [showOverride, setShowOverride] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const maxTotal =
    breakdown.members.length > 0
      ? Math.max(...breakdown.members.map((m) => m.total))
      : 1

  const avgTotal = useCountUp(breakdown.grandTotalPerPerson, 800, mounted)
  const cheapestTotal = useCountUp(breakdown.cheapestMember?.total ?? 0, 800, mounted)
  const expensiveTotal = useCountUp(breakdown.mostExpensiveMember?.total ?? 0, 800, mounted)

  function handleFuelBlur() {
    const p = parseFloat(localPetrol)
    const d = parseFloat(localDiesel)
    if (!isNaN(p) && !isNaN(d) && p > 0 && d > 0) {
      onUpdateFuelPrices?.({ petrol: p, diesel: d })
    }
  }

  function handleFoodRateBlur() {
    const r = parseFloat(localFoodRate)
    if (!isNaN(r) && r > 0) {
      onUpdateFoodRate?.(r)
    }
  }

  const smallInputStyle: React.CSSProperties = {
    fontFamily: 'DM Sans, system-ui, sans-serif',
    fontSize: '13px',
    padding: '6px 8px',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    background: 'var(--color-base)',
    color: 'var(--color-charcoal)',
    outline: 'none',
    width: '80px',
    boxSizing: 'border-box',
  }

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: '16px',
        border: '1px solid var(--color-border)',
        padding: '20px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: '22px',
            fontWeight: '700',
            color: 'var(--color-charcoal)',
            margin: '0 0 4px 0',
          }}
        >
          Cost Breakdown
        </h2>
        <span
          style={{
            fontFamily: 'DM Sans, system-ui, sans-serif',
            fontSize: '13px',
            color: 'var(--color-stone)',
          }}
        >
          {nights} night{nights !== 1 ? 's' : ''} · {breakdown.members.length} attending
        </span>
      </div>

      {/* Per-person bars */}
      <div style={{ marginBottom: '16px' }}>
        {breakdown.members.map((member, idx) => (
          <MemberBar
            key={member.uid}
            member={member}
            maxTotal={maxTotal}
            mounted={mounted}
            index={idx}
          />
        ))}
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: '14px',
          flexWrap: 'wrap',
          marginBottom: '20px',
        }}
      >
        {(Object.entries(SEGMENT_META) as Array<[Segment, typeof SEGMENT_META[Segment]]>).map(([seg, { label, color }]) => (
          <div
            key={seg}
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: 'DM Sans, system-ui, sans-serif',
                fontSize: '12px',
                color: 'var(--color-stone)',
              }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          marginBottom: editable ? '24px' : '0',
        }}
      >
        {/* Cheapest */}
        <div
          style={{
            background: 'rgba(74,103,65,0.08)',
            borderRadius: '10px',
            padding: '12px',
            border: '1px solid rgba(74,103,65,0.15)',
          }}
        >
          <div
            style={{
              fontFamily: 'DM Sans, system-ui, sans-serif',
              fontSize: '11px',
              color: '#4A6741',
              fontWeight: '600',
              marginBottom: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Cheapest
          </div>
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '15px',
              fontWeight: '700',
              color: '#4A6741',
            }}
          >
            ${Math.round(cheapestTotal)}
          </div>
          <div
            style={{
              fontFamily: 'DM Sans, system-ui, sans-serif',
              fontSize: '12px',
              color: '#4A6741',
              opacity: 0.8,
              marginTop: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {breakdown.cheapestMember?.displayName ?? '—'}
          </div>
        </div>

        {/* Average */}
        <div
          style={{
            background: 'rgba(140,133,120,0.08)',
            borderRadius: '10px',
            padding: '12px',
            border: '1px solid rgba(140,133,120,0.15)',
          }}
        >
          <div
            style={{
              fontFamily: 'DM Sans, system-ui, sans-serif',
              fontSize: '11px',
              color: 'var(--color-stone)',
              fontWeight: '600',
              marginBottom: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Average
          </div>
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '15px',
              fontWeight: '700',
              color: 'var(--color-charcoal)',
            }}
          >
            ${Math.round(avgTotal)}
          </div>
          <div
            style={{
              fontFamily: 'DM Sans, system-ui, sans-serif',
              fontSize: '12px',
              color: 'var(--color-stone)',
              marginTop: '2px',
            }}
          >
            per person
          </div>
        </div>

        {/* Most expensive */}
        {(() => {
          const isOver = breakdown.mostExpensiveMember?.overBudget ?? false
          const color = isOver ? '#E07A5F' : 'var(--color-stone)'
          const bg = isOver ? 'rgba(224,122,95,0.08)' : 'rgba(140,133,120,0.08)'
          const border = isOver ? 'rgba(224,122,95,0.2)' : 'rgba(140,133,120,0.15)'
          return (
            <div
              style={{
                background: bg,
                borderRadius: '10px',
                padding: '12px',
                border: `1px solid ${border}`,
              }}
            >
              <div
                style={{
                  fontFamily: 'DM Sans, system-ui, sans-serif',
                  fontSize: '11px',
                  color,
                  fontWeight: '600',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Highest
              </div>
              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '15px',
                  fontWeight: '700',
                  color,
                }}
              >
                ${Math.round(expensiveTotal)}
              </div>
              <div
                style={{
                  fontFamily: 'DM Sans, system-ui, sans-serif',
                  fontSize: '12px',
                  color,
                  opacity: 0.8,
                  marginTop: '2px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {breakdown.mostExpensiveMember?.displayName ?? '—'}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Fuel prices — live display + override toggle */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          paddingTop: '20px',
          marginTop: editable ? '0' : '20px',
        }}
      >
        <div
          style={{
            fontFamily: 'DM Sans, system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: '600',
            color: 'var(--color-charcoal)',
            marginBottom: '10px',
          }}
        >
          Fuel Prices ($/L)
        </div>

        <div style={{ display: 'flex', gap: '16px', marginBottom: showOverride ? '12px' : '0' }}>
          <div style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '14px', color: 'var(--color-charcoal)' }}>
            Petrol: ${fuelPrices.petrol.toFixed(2)}/L{priceIsEstimated && !showOverride ? (
              <span style={{ fontSize: '11px', color: 'var(--color-stone)', marginLeft: '4px' }}>est.</span>
            ) : null}
          </div>
          <div style={{ fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: '14px', color: 'var(--color-charcoal)' }}>
            Diesel: ${fuelPrices.diesel.toFixed(2)}/L{priceIsEstimated && !showOverride ? (
              <span style={{ fontSize: '11px', color: 'var(--color-stone)', marginLeft: '4px' }}>est.</span>
            ) : null}
          </div>
        </div>

        {editable && (
          <button
            onClick={() => setShowOverride(!showOverride)}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 0',
              fontFamily: 'DM Sans, system-ui, sans-serif',
              fontSize: '12px',
              color: 'var(--color-moss)',
              cursor: 'pointer',
              textDecoration: 'underline',
              marginTop: '6px',
            }}
          >
            {showOverride ? 'Use live price' : 'Override'}
          </button>
        )}

        {showOverride && editable && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  fontFamily: 'DM Sans, system-ui, sans-serif',
                  fontSize: '12px',
                  color: 'var(--color-stone)',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Petrol
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                style={smallInputStyle}
                value={localPetrol}
                onChange={(e) => setLocalPetrol(e.target.value)}
                onBlur={handleFuelBlur}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  fontFamily: 'DM Sans, system-ui, sans-serif',
                  fontSize: '12px',
                  color: 'var(--color-stone)',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Diesel
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                style={smallInputStyle}
                value={localDiesel}
                onChange={(e) => setLocalDiesel(e.target.value)}
                onBlur={handleFuelBlur}
              />
            </div>
          </div>
        )}
      </div>

      {/* Editable section — food rate + budget note */}
      {editable && (
        <div
          style={{
            borderTop: '1px solid var(--color-border)',
            paddingTop: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'DM Sans, system-ui, sans-serif',
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--color-charcoal)',
                marginBottom: '10px',
              }}
            >
              Food Budget
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="number"
                step="1"
                min="0"
                style={smallInputStyle}
                value={localFoodRate}
                onChange={(e) => setLocalFoodRate(e.target.value)}
                onBlur={handleFoodRateBlur}
              />
              <span
                style={{
                  fontFamily: 'DM Sans, system-ui, sans-serif',
                  fontSize: '13px',
                  color: 'var(--color-stone)',
                }}
              >
                $/person/day
              </span>
            </div>
          </div>

          <div
            style={{
              fontFamily: 'DM Sans, system-ui, sans-serif',
              fontSize: '12px',
              color: 'var(--color-stone)',
              padding: '10px 12px',
              background: 'rgba(140,133,120,0.08)',
              borderRadius: '8px',
            }}
          >
            Max budget: <strong style={{ color: 'var(--color-charcoal)' }}>${maxBudget}</strong> per person
          </div>
        </div>
      )}
    </div>
  )
}
