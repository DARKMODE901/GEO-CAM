// src/types/declarations.d.ts
declare module '*.sql' {
  const content: string;
  export default content;
}

declare module '@/drizzle/migrations' {
  const migrations: {
    journal: any;
    migrations: Record<string, string>;
  };
  export default migrations;
}

declare module '@ungap/structured-clone' {
  export default function structuredClone<T>(value: T): T;
}

declare module '@stardazed/streams-text-encoding' {
  export class TextEncoderStream {}
  export class TextDecoderStream {}
}

