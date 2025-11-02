import React, { useRef, useEffect } from 'react';
import { Speaker, TranscriptEntry } from '../types';

interface TranscriptViewProps {
  transcript: TranscriptEntry[];
  isModelSpeaking: boolean;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({ transcript, isModelSpeaking }) => {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  return (
    <div className="transcript-container">
      {transcript.length === 0 ? (
        <div className="transcript-empty">
          <p>Нажмите на микрофон, чтобы начать разговор.</p>
        </div>
      ) : (
        transcript.map((entry, index) => {
          const isLastMessage = index === transcript.length - 1;
          const isModelAndSpeaking = entry.speaker === Speaker.MODEL && isLastMessage && isModelSpeaking;
          
          return (
            <div
              key={index}
              className={`transcript-message ${entry.speaker === Speaker.USER ? 'user-message' : 'model-message'}`}
            >
              {entry.speaker === Speaker.MODEL && (
                <div className={`transcript-avatar model-avatar ${isModelAndSpeaking ? 'speaking' : ''}`}>
                  AI
                </div>
              )}
              <div className="transcript-text-wrapper">
                <p className="transcript-text">{entry.text}</p>
              </div>
              {entry.speaker === Speaker.USER && (
                <div className="transcript-avatar user-avatar">
                  Вы
                </div>
              )}
            </div>
          );
        })
      )}
      <div ref={endOfMessagesRef} />
    </div>
  );
};
