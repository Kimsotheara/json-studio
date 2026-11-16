export type EditorView = 'code' | 'tree'

export type TabKey = 'editor' | 'xml' | 'd2' | 'sql' | 'apidocs' | 'email' | 'base64' | 'uuid' | 'iplookup'

export interface ValidationResult {
  state: 'valid' | 'invalid' | 'empty'
  message: string
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }
