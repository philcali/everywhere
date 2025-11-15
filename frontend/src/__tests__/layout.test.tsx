import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Header from '../components/layout/Header';
import Layout from '../components/layout/Layout';
import Container from '../components/layout/Container';
import Grid from '../components/layout/Grid';

describe('Layout Components', () => {
  describe('Header', () => {
    it('renders the header with navigation', () => {
      render(<Header />);
      
      expect(screen.getByRole('heading', { name: /travel weather plotter/i })).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: /route planner/i })).toHaveLength(2); // Desktop and mobile
      expect(screen.getAllByRole('button', { name: /sign in/i })).toHaveLength(2); // Desktop and mobile
      expect(screen.getAllByRole('button', { name: /sign up/i })).toHaveLength(2); // Desktop and mobile
    });

    it('toggles mobile menu when hamburger button is clicked', () => {
      render(<Header />);
      
      const menuButton = screen.getByRole('button', { name: /open main menu/i });
      expect(menuButton).toBeInTheDocument();
      
      // Find the mobile menu by looking for the container with mobile navigation
      const header = menuButton.closest('header');
      const mobileMenus = header?.querySelectorAll('div');
      const mobileMenu = Array.from(mobileMenus || []).find(div => 
        div.className.includes('md:hidden') && div.querySelector('a[href="#planner"]')
      );
      
      // Mobile menu should be hidden initially
      expect(mobileMenu).toHaveClass('hidden');
      
      // Click to open menu
      fireEvent.click(menuButton);
      
      // Menu should now be visible
      expect(mobileMenu).toHaveClass('block');
      
      // Button text should change
      expect(screen.getByRole('button', { name: /close main menu/i })).toBeInTheDocument();
    });

    it('has proper mobile-first responsive classes', () => {
      render(<Header />);
      
      // Desktop navigation should be hidden on mobile
      const desktopNav = screen.getByRole('navigation');
      expect(desktopNav).toHaveClass('hidden', 'md:flex');
      
      // Mobile menu button should be hidden on desktop
      const mobileButton = screen.getByRole('button', { name: /open main menu/i });
      expect(mobileButton.parentElement).toHaveClass('md:hidden');
    });

    it('has proper touch targets for mobile', () => {
      render(<Header />);
      
      const mobileButton = screen.getByRole('button', { name: /open main menu/i });
      expect(mobileButton).toHaveClass('min-h-44', 'touch-manipulation');
    });
  });

  describe('Layout', () => {
    it('renders the complete layout structure', () => {
      render(
        <Layout>
          <div data-testid="main-content">Test content</div>
        </Layout>
      );
      
      expect(screen.getByRole('banner')).toBeInTheDocument(); // header
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('contentinfo')).toBeInTheDocument(); // footer
      expect(screen.getByTestId('main-content')).toBeInTheDocument();
    });

    it('has proper responsive layout classes', () => {
      render(
        <Layout>
          <div>Content</div>
        </Layout>
      );
      
      const layoutWrapper = screen.getByRole('main').parentElement;
      expect(layoutWrapper).toHaveClass('min-h-screen', 'flex', 'flex-col');
      
      const main = screen.getByRole('main');
      expect(main).toHaveClass('flex-1');
    });
  });

  describe('Container', () => {
    it('renders with default responsive container classes', () => {
      render(
        <Container>
          <div data-testid="container-content">Content</div>
        </Container>
      );
      
      const container = screen.getByTestId('container-content').parentElement;
      expect(container).toHaveClass('container-responsive', 'max-w-6xl');
    });

    it('renders with custom size', () => {
      render(
        <Container size="sm">
          <div data-testid="small-container">Content</div>
        </Container>
      );
      
      const container = screen.getByTestId('small-container').parentElement;
      expect(container).toHaveClass('max-w-2xl');
    });

    it('applies additional custom classes', () => {
      render(
        <Container className="custom-class">
          <div data-testid="custom-container">Content</div>
        </Container>
      );
      
      const container = screen.getByTestId('custom-container').parentElement;
      expect(container).toHaveClass('custom-class');
    });
  });

  describe('Grid', () => {
    it('renders with default grid classes', () => {
      render(
        <Grid>
          <div data-testid="grid-item">Item</div>
        </Grid>
      );
      
      const grid = screen.getByTestId('grid-item').parentElement;
      expect(grid).toHaveClass('grid', 'grid-cols-1', 'gap-6');
    });

    it('renders with custom responsive columns', () => {
      render(
        <Grid cols={{ default: 2, md: 3, lg: 4 }}>
          <div data-testid="responsive-grid">Item</div>
        </Grid>
      );
      
      const grid = screen.getByTestId('responsive-grid').parentElement;
      expect(grid).toHaveClass('grid-cols-2', 'md\\:grid-cols-3', 'lg\\:grid-cols-4');
    });

    it('renders with custom gap', () => {
      render(
        <Grid gap={8}>
          <div data-testid="gap-grid">Item</div>
        </Grid>
      );
      
      const grid = screen.getByTestId('gap-grid').parentElement;
      expect(grid).toHaveClass('gap-8');
    });
  });
});