declare module "unpdf" {
  interface ExtractTextOptions {
    mergePages?: boolean;
    cMapUrl?: string;
    cMapPacked?: boolean;
    [key: string]: unknown;
  }

  export function extractText(
    data: Uint8Array,
    options?: ExtractTextOptions
  ): Promise<{ text: string | string[]; totalPages: number }>;
}
