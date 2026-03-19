import { parseAsStringLiteral, parseAsString } from 'nuqs'

export const tradeParsers = {
  debtToken: parseAsString,
  collateralToken: parseAsString,
  mode: parseAsStringLiteral(['lend', 'swap', 'advanced'] as const).withDefault('lend'),
  amount: parseAsString,
}
