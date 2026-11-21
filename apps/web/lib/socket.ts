'use client';
import { io, type Socket } from 'socket.io-client';
import type { Ack } from '../../../packages/shared/src';
let socket: Socket | undefined;
export function getSocket(): Socket {
  if (!socket)
    socket = io(process.env.NEXT_PUBLIC_REALTIME_URL || undefined, {
      path: '/socket.io',
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      timeout: 10000,
    });
  return socket;
}
export function emit<T = unknown>(event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) =>
    getSocket()
      .timeout(12000)
      .emit(event, payload, (error: Error | null, response: Ack<T>) => {
        if (error) return reject(new Error('Server belum merespons. Periksa koneksi Anda.'));
        if (!response?.ok)
          return reject(new Error(response?.error || 'Aksi tidak dapat diproses.'));
        resolve(response.data as T);
      }),
  );
}
