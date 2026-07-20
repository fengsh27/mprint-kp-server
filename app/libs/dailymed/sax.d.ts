/**
 * Minimal ambient types for the `sax` streaming XML parser — just the surface
 * this project uses. `sax` ships no types and we avoid pulling in @types/sax
 * for this small footprint. See https://github.com/isaacs/sax-js.
 */
declare module "sax" {
  export interface SAXTag {
    name: string;
    attributes: Record<string, string>;
    isSelfClosing: boolean;
  }

  export interface SAXParser {
    write(chunk: string): SAXParser;
    close(): SAXParser;
    onopentag: (tag: SAXTag) => void;
    onclosetag: (name: string) => void;
    ontext: (text: string) => void;
    oncdata: (text: string) => void;
    onerror: (err: Error) => void;
    onend: () => void;
    resume(): SAXParser;
  }

  export function parser(strict?: boolean, opt?: Record<string, unknown>): SAXParser;
}
