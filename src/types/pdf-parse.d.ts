declare module "unpdf" {
  interface PDFDocumentProxy {
    numPages: number;
  }

  interface DocumentOptions {
    cMapUrl?: string;
    cMapPacked?: boolean;
    [key: string]: unknown;
  }

  interface ExtractTextOptions {
    mergePages?: boolean;
  }

  export function getDocumentProxy(
    data: Uint8Array,
    options?: DocumentOptions
  ): Promise<PDFDocumentProxy>;

  export function extractText(
    data: Uint8Array | PDFDocumentProxy,
    options?: ExtractTextOptions
  ): Promise<{ text: string | string[]; totalPages: number }>;
}
