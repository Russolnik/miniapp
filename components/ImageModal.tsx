import React from 'react';
import { CloseIcon } from './Icons';

interface ImageModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ imageUrl, onClose }) => {
  if (!imageUrl) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 transition-opacity duration-300"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        transition: 'opacity 0.3s'
      }}
    >
      <div 
        className="relative max-w-[90vw] max-h-[90vh] p-4"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          maxWidth: '90vw',
          maxHeight: '90vh',
          padding: '16px'
        }}
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 transition-colors z-10"
          aria-label="Close image viewer"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            color: 'white',
            background: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '50%',
            padding: '8px',
            border: 'none',
            cursor: 'pointer',
            zIndex: 10,
            transition: 'background 0.2s'
          }}
        >
          <CloseIcon className="w-6 h-6" />
        </button>
        <img 
          src={imageUrl} 
          alt="Full screen view" 
          className="w-full h-full object-contain rounded-lg shadow-2xl"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            borderRadius: '8px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
          }}
        />
      </div>
    </div>
  );
};

export default ImageModal;

