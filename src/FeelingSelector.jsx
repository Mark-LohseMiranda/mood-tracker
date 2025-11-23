import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function FeelingSelector() {
  const navigate = useNavigate()

  const feelings = [
    { value: 5, emoji: '😃', label: 'Very Happy' },
    { value: 4, emoji: '🙂', label: 'Happy'      },
    { value: 3, emoji: '😐', label: 'Neutral'   },
    { value: 2, emoji: '😢', label: 'Sad'       },
    { value: 1, emoji: '😡', label: 'Angry'     },
  ]

  const handleSelect = (emoji) => {
    navigate('/questions', { state: { feeling: emoji } })
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h1 style={{ textAlign: 'center' }}>How are you feeling?</h1>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
          paddingTop: '1rem',
        }}
      >
        {feelings.map(({ value, emoji, label }) => (
          <button
            key={emoji}
            onClick={() => handleSelect(value)}
            aria-label={label}
            style={{
              fontSize: '2.5rem',
              padding: '1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 0 5px black'
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}