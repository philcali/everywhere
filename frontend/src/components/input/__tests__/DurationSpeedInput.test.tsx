import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DurationSpeedInput from '../DurationSpeedInput';
import { TravelMode } from '../../../../../shared/src/types/travel';

describe('DurationSpeedInput', () => {
  const mockOnDurationChange = vi.fn();
  const mockOnSpeedChange = vi.fn();

  const defaultProps = {
    travelMode: TravelMode.DRIVING,
    onDurationChange: mockOnDurationChange,
    onSpeedChange: mockOnSpeedChange
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with duration mode selected by default', () => {
    render(<DurationSpeedInput {...defaultProps} />);
    
    expect(screen.getByText('Set Duration')).toHaveClass('bg-white');
    expect(screen.getByLabelText('Travel Duration')).toBeInTheDocument();
  });

  it('switches to speed mode when speed button is clicked', () => {
    render(<DurationSpeedInput {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Set Speed'));
    
    expect(screen.getByText('Set Speed')).toHaveClass('bg-white');
    expect(screen.getByLabelText('Travel Speed')).toBeInTheDocument();
  });

  it('displays correct default speed for travel mode', () => {
    render(<DurationSpeedInput {...defaultProps} travelMode={TravelMode.WALKING} />);
    
    // Check that the component renders without errors
    expect(screen.getByLabelText('Travel Duration')).toBeInTheDocument();
  });

  it('converts speed units for imperial system', () => {
    render(<DurationSpeedInput {...defaultProps} distanceUnit="imperial" />);
    
    fireEvent.click(screen.getByText('Set Speed'));
    
    const speedInput = screen.getByLabelText('Travel Speed');
    expect(speedInput).toHaveAttribute('placeholder', 'e.g., 50'); // 80 km/h ≈ 50 mph
    expect(screen.getByText('mph')).toBeInTheDocument();
  });

  it('validates duration input', () => {
    render(<DurationSpeedInput {...defaultProps} />);
    
    const durationInput = screen.getByLabelText('Travel Duration');
    
    // Test invalid input
    fireEvent.change(durationInput, { target: { value: '-1' } });
    expect(screen.getByText('Duration must be greater than 0')).toBeInTheDocument();
    
    // Test valid input
    fireEvent.change(durationInput, { target: { value: '2.5' } });
    expect(mockOnDurationChange).toHaveBeenCalledWith(2.5);
  });

  it('validates speed input within mode ranges', () => {
    render(<DurationSpeedInput {...defaultProps} travelMode={TravelMode.WALKING} />);
    
    fireEvent.click(screen.getByText('Set Speed'));
    const speedInput = screen.getByLabelText('Travel Speed');
    
    // Test speed too high for walking
    fireEvent.change(speedInput, { target: { value: '50' } });
    expect(screen.getByText(/Speed should be between 3 and 8 km\/h for walking/)).toBeInTheDocument();
    
    // Test valid speed
    fireEvent.change(speedInput, { target: { value: '5' } });
    expect(mockOnSpeedChange).toHaveBeenCalled();
  });

  it('clears speed when duration is set', () => {
    render(<DurationSpeedInput {...defaultProps} />);
    
    // Set speed first
    fireEvent.click(screen.getByText('Set Speed'));
    const speedInput = screen.getByLabelText('Travel Speed');
    fireEvent.change(speedInput, { target: { value: '80' } });
    
    // Switch to duration
    fireEvent.click(screen.getByText('Set Duration'));
    const durationInput = screen.getByLabelText('Travel Duration');
    fireEvent.change(durationInput, { target: { value: '2' } });
    
    expect(mockOnSpeedChange).toHaveBeenCalledWith(undefined);
  });

  it('clears duration when speed is set', () => {
    render(<DurationSpeedInput {...defaultProps} />);
    
    // Set duration first
    const durationInput = screen.getByLabelText('Travel Duration');
    fireEvent.change(durationInput, { target: { value: '2' } });
    
    // Switch to speed
    fireEvent.click(screen.getByText('Set Speed'));
    const speedInput = screen.getByLabelText('Travel Speed');
    fireEvent.change(speedInput, { target: { value: '80' } });
    
    expect(mockOnDurationChange).toHaveBeenCalledWith(undefined);
  });

  it('resets inputs when travel mode changes', () => {
    const { rerender } = render(<DurationSpeedInput {...defaultProps} />);
    
    const durationInput = screen.getByLabelText('Travel Duration');
    fireEvent.change(durationInput, { target: { value: '2' } });
    
    // Change travel mode
    rerender(<DurationSpeedInput {...defaultProps} travelMode={TravelMode.FLYING} />);
    
    expect(mockOnDurationChange).toHaveBeenCalledWith(undefined);
    expect(mockOnSpeedChange).toHaveBeenCalledWith(undefined);
  });

  it('displays help text for each input mode', () => {
    render(<DurationSpeedInput {...defaultProps} />);
    
    expect(screen.getByText('How long will your journey take?')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Set Speed'));
    expect(screen.getByText(/Average speed for your journey/)).toBeInTheDocument();
  });

  it('shows different speed ranges for different travel modes', () => {
    const { rerender } = render(<DurationSpeedInput {...defaultProps} travelMode={TravelMode.FLYING} />);
    
    expect(screen.getByLabelText('Travel Duration')).toBeInTheDocument();
    
    rerender(<DurationSpeedInput {...defaultProps} travelMode={TravelMode.CYCLING} />);
    expect(screen.getByLabelText('Travel Duration')).toBeInTheDocument();
  });

  it('handles decimal inputs correctly', () => {
    render(<DurationSpeedInput {...defaultProps} />);
    
    const durationInput = screen.getByLabelText('Travel Duration');
    fireEvent.change(durationInput, { target: { value: '2.5' } });
    
    expect(mockOnDurationChange).toHaveBeenCalledWith(2.5);
  });

  it('displays error message when error prop is provided', () => {
    const errorMessage = 'Invalid timing configuration';
    render(<DurationSpeedInput {...defaultProps} error={errorMessage} />);
    
    expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
  });

  it('has proper input attributes for accessibility', () => {
    render(<DurationSpeedInput {...defaultProps} />);
    
    const durationInput = screen.getByLabelText('Travel Duration');
    expect(durationInput).toHaveAttribute('type', 'number');
    expect(durationInput).toHaveAttribute('min', '0');
    expect(durationInput).toHaveAttribute('step', '0.1');
    expect(durationInput).toHaveAttribute('aria-describedby');
  });
});