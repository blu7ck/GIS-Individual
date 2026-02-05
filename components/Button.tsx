import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  icon,
  className = '',
  ...props 
}) => {
  const baseStyle = "flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-carta-gold-500 focus:ring-offset-carta-deep-900";
  
  const variants = {
    primary: "bg-carta-gold-500 hover:bg-carta-gold-600 text-white shadow-lg shadow-carta-gold-900/20",
    secondary: "bg-carta-deep-700 hover:bg-carta-deep-600 text-carta-mist-200 border border-carta-deep-600",
    danger: "bg-carta-accent-red/10 text-carta-accent-red hover:bg-carta-accent-red/20 border border-carta-accent-red/50",
    ghost: "bg-transparent hover:bg-carta-deep-800 text-carta-mist-400 hover:text-white"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
};
