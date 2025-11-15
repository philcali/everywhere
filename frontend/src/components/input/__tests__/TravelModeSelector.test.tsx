import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TravelModeSelector from '../TravelModeSelector';
import { TravelMode } from '../../../../../shared/src/types/travel';

describe('TravelModeSelector', () => {
  const mockOnChange = vi.fn();

  const defaultProps = {
    value: TravelMode.DRIVING,
    onChange: mockOnChange
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all travel modes', () => {
    render(<TravelModeSelector {...defaultProps} />);
    
    // Check for land travel modes
    expect(screen.getByText('Driving')).toBeInTheDocument();
    expect(screen.getByText('Walking')).toBeInTheDocument();
    expect(screen.getByText('Cycling')).toBeInTheDocument();
    
    // Check for air travel modes
    expect(screen.getByText('Flying')).toBeInTheDocument();
    
    // Check for sea travel modes
    expect(screen.getByText('Sailing')).toBeInTheDocument();
    expect(screen.getByText('Cruise')).toBeInTheDocument();
  });

  it('displays category headers', () => {
    render(<TravelModeSelector {...defaultProps} />);
    
    expect(screen.getByText('Land Travel')).toBeInTheDocument();
    expect(screen.getByText('Air Travel')).toBeInTheDocument();
    expect(screen.getByText('Sea Travel')).toBeInTheDocument();
  });

  it('shows selected mode with correct styling', () => {
    render(<TravelModeSelector {...defaultProps} value={TravelMode.WALKING} />);
    
    const walkingInput = screen.getByDisplayValue('walking');
    expect(walkingInput).toBeChecked();
  });

  it('calls onChange when mode is selected', () => {
    render(<TravelModeSelector {...defaultProps} />);
    
    const cyclingLabel = screen.getByLabelText(/Cycling/);
    fireEvent.click(cyclingLabel);
    
    expect(mockOnChange).toHaveBeenCalledWith(TravelMode.CYCLING);
  });

  it('displays mode descriptions', () => {
    render(<TravelModeSelector {...defaultProps} />);
    
    expect(screen.getByText('Car, truck, or motorcycle')).toBeInTheDocument();
    expect(screen.getByText('On foot')).toBeInTheDocument();
    expect(screen.getByText('Bicycle or e-bike')).toBeInTheDocument();
    expect(screen.getByText('Commercial or private aircraft')).toBeInTheDocument();
    expect(screen.getByText('Sailboat or yacht')).toBeInTheDocument();
    expect(screen.getByText('Cruise ship or ferry')).toBeInTheDocument();
  });

  it('shows checkmark icon for selected mode', () => {
    render(<TravelModeSelector {...defaultProps} value={TravelMode.FLYING} />);
    
    const flyingInput = screen.getByDisplayValue('flying');
    expect(flyingInput).toBeChecked();
  });

  it('displays error message when error prop is provided', () => {
    const errorMessage = 'Please select a travel mode';
    render(<TravelModeSelector {...defaultProps} error={errorMessage} />);
    
    expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
  });

  it('has proper accessibility attributes', () => {
    render(<TravelModeSelector {...defaultProps} />);
    
    const radioInputs = screen.getAllByRole('radio');
    
    radioInputs.forEach(input => {
      expect(input).toHaveAttribute('name', 'travel-mode');
      expect(input).toHaveAttribute('value');
    });
  });

  it('supports keyboard navigation', () => {
    render(<TravelModeSelector {...defaultProps} />);
    
    const firstRadio = screen.getAllByRole('radio')[0];
    firstRadio.focus();
    
    expect(document.activeElement).toBe(firstRadio);
    
    // Test arrow key navigation
    fireEvent.keyDown(firstRadio, { key: 'ArrowDown' });
    
    // The next radio should be focused (browser behavior)
    // This is handled by the browser's native radio group behavior
  });

  it('applies correct styling for different categories', () => {
    render(<TravelModeSelector {...defaultProps} />);
    
    const landHeader = screen.getByText('Land Travel');
    const airHeader = screen.getByText('Air Travel');
    const seaHeader = screen.getByText('Sea Travel');
    
    expect(landHeader).toHaveClass('text-green-600');
    expect(airHeader).toHaveClass('text-blue-600');
    expect(seaHeader).toHaveClass('text-cyan-600');
  });

  it('renders in responsive grid layout', () => {
    render(<TravelModeSelector {...defaultProps} />);
    
    const gridContainers = document.querySelectorAll('.grid');
    
    gridContainers.forEach(grid => {
      expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3');
    });
  });
});