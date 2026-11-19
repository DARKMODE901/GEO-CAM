// src/types/supabase-edge.d.ts
// Declaraciones de tipos de ambiente para Supabase Edge Functions (Deno Runtime)
// Permite que el servidor de lenguaje TypeScript del IDE valide supabase/functions/**/*.ts sin errores.

declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    has(key: string): boolean;
    toObject(): Record<string, string>;
  }
  export const env: Env;
  export function serve(
    handler: (req: Request) => Response | Promise<Response>
  ): void;
}

declare module 'npm:@supabase/server@1' {
  import type { SupabaseClient } from '@supabase/supabase-js';

  export interface UserClaims {
    id?: string;
    sub?: string;
    role?: string;
    email?: string;
    appMetadata?: Record<string, unknown>;
    userMetadata?: Record<string, unknown>;
  }

  export interface JwtClaims {
    sub?: string;
    email?: string;
    role?: string;
    [key: string]: unknown;
  }

  export interface SupabaseContext {
    supabase: SupabaseClient;
    supabaseAdmin: SupabaseClient;
    userClaims: UserClaims | null;
    jwtClaims: JwtClaims | null;
    authMode: 'none' | 'publishable' | 'secret' | 'user';
    authKeyName?: string;
  }

  export type SupabaseAuthMode = 'none' | 'publishable' | 'secret' | 'user';

  export interface WithSupabaseOptions {
    auth?: SupabaseAuthMode | SupabaseAuthMode[];
  }

  export function withSupabase(
    options: WithSupabaseOptions,
    handler: (req: Request, ctx: SupabaseContext) => Response | Promise<Response>
  ): (req: Request) => Promise<Response>;
}

declare module 'npm:@ai-sdk/google@4' {
  import type { LanguageModel } from 'ai';

  export interface GoogleGenerativeAIProviderSettings {
    apiKey?: string;
    baseURL?: string;
    headers?: Record<string, string>;
  }

  export type GoogleGenerativeAIProvider = (modelId: string) => LanguageModel;

  export function createGoogleGenerativeAI(
    options?: GoogleGenerativeAIProviderSettings
  ): GoogleGenerativeAIProvider;
}

declare module 'npm:ai@7' {
  export * from 'ai';
}

declare module 'npm:zod@3' {
  export * from 'zod';
}
