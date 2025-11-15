import { useState } from 'react';
import { AuthButton } from '../auth';

interface HeaderProps {
  onMenuToggle?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
    onMenuToggle?.();
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container-responsive">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Title */}
          <div className="flex items-center">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-primary-600">
                Travel Weather Plotter
              </h1>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            <a href="#planner" className="nav-link nav-link-active">
              Route Planner
            </a>
            <a href="#journal" className="nav-link nav-link-inactive">
              Travel Journal
            </a>
            <a href="#about" className="nav-link nav-link-inactive">
              About
            </a>
          </nav>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <AuthButton />
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={toggleMobileMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 min-h-44 touch-manipulation"
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? 'Close main menu' : 'Open main menu'}
            >
              <span className="sr-only">{isMobileMenuOpen ? 'Close main menu' : 'Open main menu'}</span>
              {/* Hamburger icon */}
              <svg
                className={`${isMobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              {/* Close icon */}
              <svg
                className={`${isMobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:hidden`}>
          <div className="px-2 pt-4 pb-3 space-y-1 sm:px-3 border-t border-gray-200">
            <a
              href="#planner"
              className="nav-link nav-link-active block min-h-44 touch-manipulation"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Route Planner
            </a>
            <a
              href="#journal"
              className="nav-link nav-link-inactive block min-h-44 touch-manipulation"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Travel Journal
            </a>
            <a
              href="#about"
              className="nav-link nav-link-inactive block min-h-44 touch-manipulation"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              About
            </a>
            <div className="pt-4 pb-3 border-t border-gray-200">
              <div className="flex flex-col space-y-3">
                <AuthButton />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;