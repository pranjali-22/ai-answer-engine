
export interface InputDetection {
  hasUrl: boolean;
  url: string | null;
  query: string;
}

export function detectInputType(input: string): InputDetection {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const urls = input.match(urlPattern);

  return {
    hasUrl: !!urls,
    url: urls ? urls[0] : null,
    query: input.replace(urlPattern, "").trim()
  };
}

export function isContentValid(content: any): boolean {
  return (
    content &&
    content.mainContent &&
    content.mainContent.length > 100
  );
}