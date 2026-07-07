import React, { useEffect, useRef } from 'react';
import { Overlay } from '../vanilla/Overlay.js';
import type { PinmarkSettings, PinmarkConfig } from '../core/types.js';
import type { PinmarkAnnotation } from '@pinmark/core';

export interface PinmarkProps extends PinmarkConfig {
  settings?: PinmarkSettings;
  initialFeedback?: PinmarkAnnotation[];
}

export const Pinmark: React.FC<PinmarkProps> = ({
  settings,
  initialFeedback = [],
  ...config
}) => {
  const overlayRef = useRef<Overlay | null>(null);

  useEffect(() => {
    // Default settings if none provided
    const defaultSettings: PinmarkSettings = {
      markerColor: '#ef4444',
      outputDetail: 'standard',
      clearAfterCopy: false,
      blockInteractions: false,
      hideUntilRestart: false,
      theme: 'auto',
      ...settings,
    };

    if (!overlayRef.current) {
      overlayRef.current = new Overlay(defaultSettings, config, initialFeedback);
    } else {
      overlayRef.current.updateSettings(defaultSettings);
    }

    if (config.isActive && !overlayRef.current.isActive) {
      overlayRef.current.activate();
    } else if (!config.isActive && overlayRef.current.isActive) {
      overlayRef.current.deactivate();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, config.isActive, config.url]);

  useEffect(() => {
    return () => {
      if (overlayRef.current) {
        if (overlayRef.current.isActive) {
          overlayRef.current.deactivate();
        }
        overlayRef.current = null;
      }
    };
  }, []);

  return null; // Pinmark renders its own shadow DOM root directly to body
};
