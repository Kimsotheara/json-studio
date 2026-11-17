export type TabKey = 'editor' | 'xml' | 'd2' | 'sql' | 'erd' | 'apidocs' | 'base64' | 'uuid' | 'iplookup'

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }
