import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  colorClass?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ size = 'md', colorClass }) => {
  const sizeConfig: Record<string, { size: number; border: number }> = {
    sm: { size: 20, border: 2 },
    md: { size: 32, border: 2 },
    lg: { size: 40, border: 2 },
  };

  const config = sizeConfig[size] || sizeConfig.md;
  const borderColor = colorClass || '#4FC3F7';
  
  const spinnerStyle: React.CSSProperties = {
    width: `${config.size}px`,
    height: `${config.size}px`,
    border: `${config.border}px solid transparent`,
    borderTopColor: borderColor,
    borderRightColor: borderColor,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  };

  return (
    <>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={spinnerStyle}></div>
      </div>
    </>
  );
};

export default Spinner;
