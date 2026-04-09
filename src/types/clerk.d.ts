declare global {
  interface Window {
    Clerk?: {
      loaded?: boolean;
      session?: {
        getToken: () => Promise<string | null>;
      };
    };
  }
}

export {};
