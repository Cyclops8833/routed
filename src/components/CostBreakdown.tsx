import { useState, useEffect, useRef } from 'react'
import type { CostBreakdown as CostBreakdownData, CostLineItem, FuelPrices, MemberCost } from '../utils/costEngine'

interface CostBreakdownProps {
  breakdown: CostBreakdownData
  maxBudget: number
  onAddLineItem?: (item: Omit<CostLineItem, 'id'>) => void
  onRemoveLineItem?: (id: string) => void
  onUpdateFuelPrices?: (prices: FuelPrices) => void
  onUpdateFoodRate?: (rate: number) => void
  editable?: boolean
  nights: number
  lineItems: CostLineItem[]
  fuelPrices: FuelPrices
  dailyFoodRate: number
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
  const fuelPct = maxTotal > 0 ? (member.fuelCost / maxTotal) * 100 : 0
  const campPct = maxTotal > 0 ? (member.campsiteCost / maxTotal) * 100 : 0
  const foodPct = maxTotal > 0 ? (member.foodCost / maxTotal) * 100 : 0
  const otherPct = maxTotal > 0 ? (member.otherCost / maxTotal) * 100 : 0

  const animatedTotal = useCountUp(member.total, 800, mounted)

  const barStyle = (pct: number, bg: string): React.CSSProperties => ({
    width: mounted ? `${pct}%` : '0%',
    height: '100%',
    backgroundColor: bg,
    transition: 'width 600ms ease-out',
    flexShrink: 0,
  })

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
      <div
        style={{
          height: '14px',
          borderRadius: '7px',
          overflow: 'hidden',
          background: 'rgba(140,133,120,0.12)',
          display: 'flex',
        }}
      >
        <div style={barStyle(fuelPct, '#4A6741')} />
        <div style={barStyle(campPct, '#C4893B')} />
        <div style={barStyle(foodPct, '#B85C38')} />
        <div style={barStyle(otherPct, '#8C8578')} />
      </div>
    </div>
  )
}

interface EditingItem {
  id: string
  label: string
  amount: string
}

export default function CostBreakdown({
  breakdown,
  maxBudget,
  onAddLineItem,
  onRemoveLineItem,
  onUpdateFuelPrices,
  onUpdateFoodRate,
  editable = false,
  nights,
  lineItems,
  fuelPrices,
  dailyFoodRate,
}: CostBreakdownProps) {
  const [mounted, setMounted] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null)
  const [localPetrol, setLocalPetrol] = useState(String(fuelPrices.petrol))
  const [localDiesel, setLocalDiesel] = useState(String(fuelPrices.diesel))
  const [localFoodRate, setLocalFoodRate] = useState(String(dailyFoodRate))

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

  function handleAddItem() {
    const amt = parseFloat(newAmount)
    if (!newLabel.trim() || isNaN(amt) || amt <= 0) return
    onAddLineItem?.({ label: newLabel.trim(), amount: amt, addedByUid: '' })
    setNewLabel('')
    setNewAmount('')
  }

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

  const inputStyle: React.CSSProperties = {
    fontFamily: 'DM Sans, system-ui, sans-serif',
    fontSize: '14px',
    padding: '8px 10px',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    background: 'var(--color-base)',
    color: 'var(--color-charcoal)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }

  const smallInputStyle: React.CSSProperties = {
    ...inputStyle,
    width: '80px',
    fontSize: '13px',
    padding: '6px 8px',
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
        {[
          { label: 'Fuel', color: '#4A6741' },
          { label: 'Camp', color: '#C4893B' },
          { label: 'Food', color: '#B85C38' },
          { label: 'Other', color: '#8C8578' },
        ].map(({ label, color }) => (
          <div
            key={label}
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

      {/* Editable section */}
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
          {/* Fuel prices */}
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
              Fuel Prices ($/L)
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
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
          </div>

          {/* Food rate */}
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

          {/* Line items */}
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
              Shared Expenses
            </div>

            {lineItems.length > 0 && (
              <div style={{ marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {lineItems.map((item) => (
                  <div key={item.id}>
                    {editingItem?.id === item.id ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          style={{ ...inputStyle, flex: 1 }}
                          value={editingItem.label}
                          onChange={(e) =>
                            setEditingItem({ ...editingItem, label: e.target.value })
                          }
                        />
                        <input
                          type="number"
                          step="1"
                          min="0"
                          style={{ ...inputStyle, width: '80px' }}
                          value={editingItem.amount}
                          onChange={(e) =>
                            setEditingItem({ ...editingItem, amount: e.target.value })
                          }
                        />
                        <button
                          onClick={() => {
                            const amt = parseFloat(editingItem.amount)
                            if (editingItem.label.trim() && !isNaN(amt) && amt > 0) {
                              onRemoveLineItem?.(item.id)
                              onAddLineItem?.({
                                label: editingItem.label.trim(),
                                amount: amt,
                                addedByUid: item.addedByUid,
                              })
                            }
                            setEditingItem(null)
                          }}
                          style={{
                            padding: '6px 12px',
                            background: '#4A6741',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontFamily: 'DM Sans, system-ui, sans-serif',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingItem(null)}
                          style={{
                            padding: '6px 10px',
                            background: 'transparent',
                            color: 'var(--color-stone)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontFamily: 'DM Sans, system-ui, sans-serif',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: 'var(--color-base)',
                          border: '1px solid var(--color-border)',
                          cursor: 'pointer',
                        }}
                        onClick={() =>
                          setEditingItem({
                            id: item.id,
                            label: item.label,
                            amount: String(item.amount),
                          })
                        }
                      >
                        <span
                          style={{
                            fontFamily: 'DM Sans, system-ui, sans-serif',
                            fontSize: '14px',
                            color: 'var(--color-charcoal)',
                            flex: 1,
                          }}
                        >
                          {item.label}
                        </span>
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '13px',
                            color: 'var(--color-stone)',
                          }}
                        >
                          ${item.amount}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveLineItem?.(item.id)
                          }}
                          style={{
                            padding: '2px 6px',
                            background: 'transparent',
                            color: '#E07A5F',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '16px',
                            lineHeight: 1,
                            borderRadius: '4px',
                          }}
                          aria-label="Remove item"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add expense form */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
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
                  Description
                </label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Firewood"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddItem()
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontFamily: 'DM Sans, system-ui, sans-serif',
                    fontSize: '12px',
                    color: 'var(--color-stone)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Amount ($)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  style={{ ...inputStyle, width: '90px' }}
                  placeholder="0"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddItem()
                  }}
                />
              </div>
              <button
                onClick={handleAddItem}
                style={{
                  padding: '8px 16px',
                  background: '#4A6741',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  fontFamily: 'DM Sans, system-ui, sans-serif',
                  whiteSpace: 'nowrap',
                  height: '38px',
                }}
              >
                Add
              </button>
            </div>
          </div>

          {/* Budget note */}
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
