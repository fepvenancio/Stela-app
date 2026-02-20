export interface StarknetEvent {
  keys: string[]
  data: string[]
  transaction: { hash: string }
  block: { number: bigint; timestamp: bigint }
}
