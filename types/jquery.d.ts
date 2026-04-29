declare module 'jquery';
declare module 'cytoscape-panzoom';
declare module 'cytoscape' {
  export function use(extension: any): void;
  interface Core {
    panzoom?: (options?: any) => any;
    data?: (key: string, value?: unknown) => unknown;
  }
}
declare module 'cytoscape-klay';
declare module 'cytoscape-fcose';
