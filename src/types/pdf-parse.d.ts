declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export const GlobalWorkerOptions: { workerSrc: string };

  export function getDocument(params: {
    data: Uint8Array;
    disableWorker?: boolean;
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
