import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { 
  ResponsiveWrapper, 
  MobileOnly, 
  DesktopOnly, 
  TabletUp, 
  ResponsiveText, 
  ResponsiveSpacing 
} from '../components/layout/Responsive';

describe('Responsive Components', () => {
  describe('ResponsiveWrapper', () => {
    it('renders children with responsive wrapper classes', () => {
      render(
        <ResponsiveWrapper className="test-class">
          <div data-testid="child">Test content</div>
        </ResponsiveWrapper>
      );
      
      const wrapper = screen.getByTestId('child').parentElement;
      expect(wrapper).toHaveClass('w-full', 'test-class');
    });
  });

  describe('MobileOnly', () => {
    it('renders with mobile-only classes', () => {
      render(
        <MobileOnly>
          <div data-testid="mobile-content">Mobile content</div>
        </MobileOnly>
      );
      
      const wrapper = screen.getByTestId('mobile-content').parentElement;
      expect(wrapper).toHaveClass('block', 'md:hidden');
    });
  });

  describe('DesktopOnly', () => {
    it('renders with desktop-only classes', () => {
      render(
        <DesktopOnly>
          <div data-testid="desktop-content">Desktop content</div>
        </DesktopOnly>
      );
      
      const wrapper = screen.getByTestId('desktop-content').parentElement;
      expect(wrapper).toHaveClass('hidden', 'md:block');
    });
  });

  describe('TabletUp', () => {
    it('renders with tablet-up classes', () => {
      render(
        <TabletUp>
          <div data-testid="tablet-content">Tablet content</div>
        </TabletUp>
      );
      
      const wrapper = screen.getByTestId('tablet-content').parentElement;
      expect(wrapper).toHaveClass('hidden', 'sm:block');
    });
  });

  describe('ResponsiveText', () => {
    it('renders with default responsive text classes', () => {
      render(<ResponsiveText>Test text</ResponsiveText>);
      
      const text = screen.getByText('Test text');
      expect(text).toHaveClass('text-base', 'sm:text-lg');
    });

    it('renders with custom size classes', () => {
      render(<ResponsiveText size="xl">Large text</ResponsiveText>);
      
      const text = screen.getByText('Large text');
      expect(text).toHaveClass('text-xl', 'sm:text-2xl');
    });

    it('renders with additional custom classes', () => {
      render(
        <ResponsiveText size="lg" className="font-bold">
          Bold text
        </ResponsiveText>
      );
      
      const text = screen.getByText('Bold text');
      expect(text).toHaveClass('text-lg', 'sm:text-xl', 'font-bold');
    });
  });

  describe('ResponsiveSpacing', () => {
    it('renders with default responsive spacing classes', () => {
      render(
        <ResponsiveSpacing>
          <div data-testid="spaced-content">Content</div>
        </ResponsiveSpacing>
      );
      
      const wrapper = screen.getByTestId('spaced-content').parentElement;
      expect(wrapper).toHaveClass('p-4', 'sm:p-6', 'lg:p-8', 'm-4', 'sm:m-6', 'lg:m-8');
    });

    it('renders with custom spacing sizes', () => {
      render(
        <ResponsiveSpacing padding="lg" margin="sm">
          <div data-testid="custom-spaced">Content</div>
        </ResponsiveSpacing>
      );
      
      const wrapper = screen.getByTestId('custom-spaced').parentElement;
      expect(wrapper).toHaveClass('p-6', 'sm:p-8', 'lg:p-12', 'm-2', 'sm:m-4');
    });
  });
});