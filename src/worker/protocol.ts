export type Disc = { kind: 'file'; file: File } | { kind: 'folder'; name: string; files: [string, File][] }

export interface BuildRequest {
  id: number
  disc: Disc
  port: FileSystemDirectoryHandle
  characters: Uint8Array[]
}

export type BuildReply =
  | { id: number; progress: [string, number, number] }
  | { id: number; result: string }
  | { id: number; error: string }