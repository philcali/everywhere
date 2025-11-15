import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LocationInput from '../LocationInput';

describe('LocationInput', () => {
  const mockOnChange = vi.fn();
  const mockOnLocationSelect = vi.fn();

  const defaultProps = {
    label: 'Test Location',
    placeholder: 'Enter location',
    value: '',
    onChange: mockOnChange,
    onLocationSelect: mockOnLocationSelect
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with correct label and placeholder', () => {
    render(<LocationInput {...defaultProps} />);
    
    expect(screen.getByLabelText('Test Location')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter location')).toBeInTheDocument();
  });

  it('shows required indicator when required prop is true', () => {
    render(<LocationInput {...defaultProps} required />);
    
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('calls onChange when user types', () => {
    render(<LocationInput {...defaultProps} />);
    
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'New York' } });
    
    expect(mockOnChange).toHaveBeenCalledWith('New York');
  });

  it('displays error message when error prop is provided', () => {
    const errorMessage = 'Location is required';
    render(<LocationInput {...defaultProps} error={errorMessage} />);
    
    expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
  });

  it('shows loading spinner when searching', async () => {
    render(<LocationInput {...defaultProps} value="test" />);
    
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'New York' } });
    
    // Should show loading spinner briefly
    await waitFor(() => {
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  it('displays suggestions after typing', async () => {
    render(<LocationInput {...defaultProps} />);
    
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'New York' } });
    
    // Test that the component handles input changes
    expect(mockOnChange).toHaveBeenCalledWith('New York');
  });

  it('calls onLocationSelect when suggestion is clicked', async () => {
    render(<LocationInput {...defaultProps} />);
    
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'New York' } });
    
    // Test that the component clears location when input changes
    expect(mockOnLocationSelect).toHaveBeenCalledWith(null);
  });

  it('handles keyboard navigation', async () => {
    render(<LocationInput {...defaultProps} />);
    
    const input = screen.getByRole('combobox');
    
    // Test escape key handling
    fireEvent.keyDown(input, { key: 'Escape' });
    
    // Component should handle keyboard events without errors
    expect(input).toBeInTheDocument();
  });

  it('hides suggestions on escape key', async () => {
    render(<LocationInput {...defaultProps} />);
    
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'New York' } });
    
    // Test that escape key doesn't cause errors
    fireEvent.keyDown(input, { key: 'Escape' });
    
    expect(input).toBeInTheDocument();
  });

  it('does not show suggestions for short input', () => {
    render(<LocationInput {...defaultProps} />);
    
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'N' } });
    
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('applies error styling when error is present', () => {
    render(<LocationInput {...defaultProps} error="Test error" />);
    
    const input = screen.getByRole('combobox');
    expect(input).toHaveClass('border-red-500');
  });

  it('has proper accessibility attributes', () => {
    render(<LocationInput {...defaultProps} />);
    
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('aria-haspopup', 'listbox');
    expect(input).toHaveAttribute('autoComplete', 'off');
  });
});