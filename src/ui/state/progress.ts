import { signal } from "npm:@preact/signals";

export interface DownloadProgressState {
  loaded: number;
  total: number;
}

export const downloadProgress = signal(new Map<string, DownloadProgressState>());

export function updateProgress(name: string, loaded: number, total: number): void {
  downloadProgress.value = new Map(downloadProgress.value.set(name, { loaded, total }));
}
