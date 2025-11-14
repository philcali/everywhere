import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App', () => {
  it('renders the main heading', () => {
    render(<App />)
    const heading = screen.getByRole('heading', { name: /plan your journey with weather insights/i })
    expect(heading).toBeInTheDocument()
  })

  it('renders the header title', () => {
    render(<App />)
    const headerTitle = screen.getByRole('heading', { name: /travel weather plotter/i, level: 1 })
    expect(headerTitle).toBeInTheDocument()
  })

  it('renders the description text', () => {
    render(<App />)
    const description = screen.getByText(/get comprehensive weather forecasts along your travel route/i)
    expect(description).toBeInTheDocument()
  })

  it('renders feature cards', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /route planning/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /weather forecasting/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /travel journal/i })).toBeInTheDocument()
  })

  it('renders call-to-action button', () => {
    render(<App />)
    const ctaButton = screen.getByRole('button', { name: /start planning your journey/i })
    expect(ctaButton).toBeInTheDocument()
  })
})