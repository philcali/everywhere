import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WeatherIconDisplay } from '../WeatherIconDisplay';
import { WeatherCondition, PrecipitationType } from '../../../types/shared';

describe('WeatherIconDisplay', () => {
  it('renders sunny weather icon', () => {
    const { container } = render(
      <WeatherIconDisplay 
        condition={WeatherCondition.SUNNY} 
        precipitationType={PrecipitationType.NONE} 
      />
    );
    
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('text-yellow-500');
  });

  it('renders rain icon when precipitation type is rain', () => {
    const { container } = render(
      <WeatherIconDisplay 
        condition={WeatherCondition.CLOUDY} 
        precipitationType={PrecipitationType.RAIN} 
      />
    );
    
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('text-blue-500');
  });

  it('renders snow icon when precipitation type is snow', () => {
    const { container } = render(
      <WeatherIconDisplay 
        condition={WeatherCondition.CLOUDY} 
        precipitationType={PrecipitationType.SNOW} 
      />
    );
    
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('text-blue-200');
  });

  it('renders stormy weather icon', () => {
    const { container } = render(
      <WeatherIconDisplay 
        condition={WeatherCondition.STORMY} 
        precipitationType={PrecipitationType.NONE} 
      />
    );
    
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('text-purple-600');
  });

  it('applies custom size and className', () => {
    const { container } = render(
      <WeatherIconDisplay 
        condition={WeatherCondition.SUNNY} 
        precipitationType={PrecipitationType.NONE}
        size={48}
        className="custom-class"
      />
    );
    
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('custom-class');
    expect(svg).toHaveAttribute('width', '48');
    expect(svg).toHaveAttribute('height', '48');
  });

  it('prioritizes precipitation type over general condition', () => {
    const { container } = render(
      <WeatherIconDisplay 
        condition={WeatherCondition.SUNNY} 
        precipitationType={PrecipitationType.HAIL} 
      />
    );
    
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('text-purple-500');
  });
});