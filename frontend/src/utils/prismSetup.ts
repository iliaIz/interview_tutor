import Prism from 'prismjs';

// Polyfill global Prism so that prismjs language components (prism-java, prism-sql, etc.)
// can properly attach themselves to Prism.languages without throwing ReferenceError
if (typeof window !== 'undefined') {
  (window as any).Prism = Prism;
}
if (typeof globalThis !== 'undefined') {
  (globalThis as any).Prism = Prism;
}

export default Prism;
