// src/repositories/chatRepository.ts
// Persistencia local en SQLite para el historial de mensajes del Tutor IA (C1)

import { asc } from 'drizzle-orm';
import { db } from '@/db/client';
import { chatMessages } from '@/db/schema';
import type { UIMessage } from 'ai';

/**
 * Repositorio de mensajes de chat en SQLite con Drizzle ORM
 */
export const chatRepository = {
  /**
   * Obtiene todos los mensajes ordenados cronológicamente
   */
  async getAll(): Promise<UIMessage[]> {
    const rows = await db
      .select()
      .from(chatMessages)
      .orderBy(asc(chatMessages.createdAt));

    return rows.map((r): UIMessage => {
      let parts: any[] = [];
      if (r.parts) {
        try {
          parts = JSON.parse(r.parts);
        } catch {
          parts = [{ type: 'text', text: r.content }];
        }
      } else {
        parts = [{ type: 'text', text: r.content }];
      }

      return {
        id: r.id,
        role: r.role as any,
        parts,
      };
    });
  },

  /**
   * Guarda o actualiza (upsert) mensajes por su id
   */
  async upsert(msg: UIMessage): Promise<void> {
    const textPart = msg.parts
      ?.filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('\n') || '';

    const partsJson = JSON.stringify(msg.parts || []);
    const createdAtMs = (msg as any).createdAt
      ? new Date((msg as any).createdAt).getTime()
      : Date.now();

    await db
      .insert(chatMessages)
      .values({
        id: msg.id,
        role: msg.role,
        content: textPart,
        parts: partsJson,
        createdAt: createdAtMs,
      })
      .onConflictDoUpdate({
        target: chatMessages.id,
        set: {
          role: msg.role,
          content: textPart,
          parts: partsJson,
        },
      });
  },

  /**
   * Guarda un lote de mensajes mediante upsert
   */
  async upsertMany(messages: UIMessage[]): Promise<void> {
    for (const msg of messages) {
      await this.upsert(msg);
    }
  },

  /**
   * Limpia toda la conversación local en SQLite ("Nueva conversación")
   */
  async clearAll(): Promise<void> {
    await db.delete(chatMessages);
  },
};
