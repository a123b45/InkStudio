/**
 * Shared type definitions for Slate MERN app.
 * These types describe the Slate document structure stored in MongoDB.
 */

// Base Slate element type (block-level nodes like paragraphs, headings, lists)
export interface CustomElement {
  type: string;
  children: CustomText[];
  align?: 'left' | 'center' | 'right' | 'justify';
  [key: string]: any;
}

// Base Slate text type (leaf nodes with formatting marks)
export interface CustomText {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
  strikethrough?: boolean;
  [key: string]: any;
}

// Descendant is a union of Element and Text
export type CustomDescendant = CustomElement | CustomText;
