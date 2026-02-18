declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export function getDocument(params: {
    data: Uint8Array;
  }): {
    promise: Promise<PDFDocumentProxy>;
  };

  interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
  }

  interface PDFPageProxy {
    getTextContent(): Promise<TextContent>;
  }

  interface TextContent {
    items: TextItem[];
  }

  interface TextItem {
    str?: string;
    [key: string]: unknown;
  }
}
