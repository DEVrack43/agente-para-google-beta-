/// <reference types="vite/client" />

declare module "react" {
  export type ComponentType<P = {}> = any;
  export type ReactNode = any;
  export type ReactElement = any;
  export interface Attributes {}
  export interface ClassAttributes<T> extends Attributes {}
  export function useState<S>(initialState: S | (() => S)): [S, (value: S | ((prev: S) => S)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export const Fragment: any;
  export function createElement(type: any, props: any, ...children: any[]): any;
}

declare module "react/jsx-runtime" {
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
  export function jsxDEV(type: any, props: any, key?: any, isStaticChildren?: any, source?: any, self?: any): any;
}

declare module "lucide-react" {
  export const Sparkles: any;
  export const Database: any;
  export const Inbox: any;
  export const LogOut: any;
  export const RefreshCw: any;
  export const AlertTriangle: any;
  export const Check: any;
  export const Loader2: any;
  export const HardDrive: any;
  export const Mail: any;
  export const HelpCircle: any;
  export const FolderOpen: any;
  export const Trash2: any;
  export const ShieldAlert: any;
  export const File: any;
  export const Image: any;
  export const FileText: any;
  export const Folder: any;
  export const Search: any;
  export const CheckSquare: any;
  export const Square: any;
  export const ExternalLink: any;
  export const ChevronRight: any;
  export const Info: any;
  export const Calendar: any;
  export const Layers: any;
  export const Filter: any;
  export const CheckCircle: any;
}

declare module "firebase/auth" {
  export interface User {
    uid: string;
    email: string | null;
    displayName?: string | null;
    photoURL?: string | null;
  }
  export function getAuth(): any;
  export function onAuthStateChanged(auth: any, callback: any, errorCallback?: any): any;
}

declare module "@google/genai" {
  const anything: any;
  export default anything;
}

declare module "@tailwindcss/vite" {
  const anything: any;
  export default anything;
}

declare module "@vitejs/plugin-react" {
  const anything: any;
  export default anything;
}

declare namespace JSX {
  interface Element {}
  interface ElementClass {}
  interface ElementAttributesProperty { props: any; }
  interface IntrinsicElements {
    [elemName: string]: any;
  }
  interface IntrinsicAttributes {
    [elemName: string]: any;
  }
  interface ElementChildrenAttribute {
    children: {};
  }
}
