import { describe, it, expect } from 'vitest';
import { ComponentInfoSchema, ElementInfoSchema, PinmarkAnnotationSchema } from './schema';

describe('ComponentInfoSchema', () => {
  it('should parse valid component info', () => {
    const data = {
      framework: 'react',
      name: 'Button',
      props: { variant: 'primary' },
      filePath: 'src/components/Button.tsx',
      lineNumber: 42
    };
    
    const result = ComponentInfoSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.framework).toBe('react');
    }
  });

  it('should reject invalid framework', () => {
    const data = {
      framework: 'jquery', // invalid framework
      name: 'Button'
    };
    
    const result = ComponentInfoSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe('ElementInfoSchema', () => {
  it('should require mandatory fields', () => {
    const data = {
      selector: '.btn',
      tagName: 'button',
      classes: ['btn', 'btn-primary'],
      dataAttributes: {},
      boundingRect: {
        x: 0, y: 0, width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0
      }
    };
    
    const result = ElementInfoSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject if boundingRect is missing', () => {
    const data = {
      selector: '.btn',
      tagName: 'button',
      classes: [],
      dataAttributes: {}
    };
    
    const result = ElementInfoSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe('PinmarkAnnotationSchema', () => {
  it('should parse valid full annotation', () => {
    const data = {
      id: 'annot-123',
      index: 0,
      comment: 'Fix this button',
      url: 'http://localhost:3000',
      timestamp: 1690000000,
      element: {
        selector: '.btn',
        tagName: 'button',
        classes: ['btn'],
        dataAttributes: {},
        boundingRect: { x: 0, y: 0, width: 100, height: 50, top: 0, right: 100, bottom: 50, left: 0 }
      },
      category: 'bug',
      severity: 'blocking'
    };
    
    const result = PinmarkAnnotationSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe('bug');
      expect(result.data.severity).toBe('blocking');
    }
  });
});
