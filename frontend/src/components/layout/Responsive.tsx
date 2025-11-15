import { ReactNode } from 'react';

interface ResponsiveProps {
  children: ReactNode;
  className?: string;
}

// Responsive wrapper component for consistent mobile-first design
export const ResponsiveWrapper: React.FC<ResponsiveProps> = ({ children, className = '' }) => {
  return (
    <div className={`w-full ${className}`}>
      {children}
    </div>
  );
};

// Mobile-specific component that only renders on mobile
export const MobileOnly: React.FC<ResponsiveProps> = ({ children, className = '' }) => {
  return (
    <div className={`block md:hidden ${className}`}>
      {children}
    </div>
  );
};

// Desktop-specific component that only renders on desktop
export const DesktopOnly: React.FC<ResponsiveProps> = ({ children, className = '' }) => {
  return (
    <div className={`hidden md:block ${className}`}>
      {children}
    </div>
  );
};

// Tablet and up component
export const TabletUp: React.FC<ResponsiveProps> = ({ children, className = '' }) => {
  return (
    <div className={`hidden sm:block ${className}`}>
      {children}
    </div>
  );
};

// Responsive text component with mobile-first sizing
interface ResponsiveTextProps {
  children: ReactNode;
  size?: 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  className?: string;
}

export const ResponsiveText: React.FC<ResponsiveTextProps> = ({ 
  children, 
  size = 'base', 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'text-sm sm:text-base',
    base: 'text-base sm:text-lg',
    lg: 'text-lg sm:text-xl',
    xl: 'text-xl sm:text-2xl',
    '2xl': 'text-xl sm:text-2xl lg:text-3xl',
    '3xl': 'text-2xl sm:text-3xl lg:text-4xl',
    '4xl': 'text-3xl sm:text-4xl lg:text-5xl',
    '5xl': 'text-4xl sm:text-5xl lg:text-6xl'
  };

  return (
    <span className={`${sizeClasses[size]} ${className}`}>
      {children}
    </span>
  );
};

// Responsive spacing component
interface ResponsiveSpacingProps {
  children: ReactNode;
  padding?: 'sm' | 'md' | 'lg' | 'xl';
  margin?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const ResponsiveSpacing: React.FC<ResponsiveSpacingProps> = ({ 
  children, 
  padding = 'md', 
  margin = 'md',
  className = '' 
}) => {
  const paddingClasses = {
    sm: 'p-2 sm:p-4',
    md: 'p-4 sm:p-6 lg:p-8',
    lg: 'p-6 sm:p-8 lg:p-12',
    xl: 'p-8 sm:p-12 lg:p-16'
  };

  const marginClasses = {
    sm: 'm-2 sm:m-4',
    md: 'm-4 sm:m-6 lg:m-8',
    lg: 'm-6 sm:m-8 lg:m-12',
    xl: 'm-8 sm:m-12 lg:m-16'
  };

  return (
    <div className={`${paddingClasses[padding]} ${marginClasses[margin]} ${className}`}>
      {children}
    </div>
  );
};