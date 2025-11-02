import React from 'react';

interface ImageModalProps {
  imageUrl: string;
  onClose: () => void;
  onDownload: () => void;
}

const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const ImageModal: React.FC<ImageModalProps> = ({ imageUrl, onClose, onDownload }) => {
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="relative max-w-[90vw] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={imageUrl} alt="Полноэкранное изображение" className="w-full h-full object-contain" />
        <button 
          onClick={onClose}
          className="absolute -top-4 -right-4 bg-gray-800 text-white rounded-full h-10 w-10 flex items-center justify-center text-2xl font-bold hover:bg-red-500"
          aria-label="Закрыть"
        >
          &times;
        </button>
        <button 
            onClick={onDownload}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-cyan-500 text-white py-2 px-6 rounded-lg hover:bg-cyan-600 flex items-center"
            aria-label="Скачать изображение"
        >
            <DownloadIcon /> Скачать
        </button>
      </div>
    </div>
  );
};

export default ImageModal;

