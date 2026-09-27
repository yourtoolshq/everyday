export type DecimalEntryResult =
  { ok: true; value: string } | { ok: false; message: string };

const invalidMessage = "Enter a number or a simple + - * / expression.";
const divideByZeroMessage = "Can't divide by zero.";

type Operator = "+" | "-" | "*" | "/";
type Token =
  { kind: "number"; value: number } | { kind: "operator"; value: Operator };

/**
 * Presentation-only money entry. Empty stays empty. Plain numbers and
 * `+ - * /` expressions normalize on commit. This does not evaluate arbitrary
 * code, and it does not apply currency or range rules.
 */
export function normalizeDecimalEntry(
  raw: string,
  fractionDigits = 2,
): DecimalEntryResult {
  const source = raw
    .trim()
    .replaceAll(",", "")
    .replaceAll("$", "")
    .replaceAll("%", "")
    .replaceAll(/\s+/g, "");
  if (source === "") return { ok: true, value: "" };

  const tokens = tokenize(source);
  if (!tokens) return { ok: false, message: invalidMessage };

  const parsed = parseExpression(tokens);
  if (!parsed.ok) return parsed;
  if (parsed.position !== tokens.length || !Number.isFinite(parsed.value)) {
    return { ok: false, message: invalidMessage };
  }

  return { ok: true, value: parsed.value.toFixed(fractionDigits) };
}

function tokenize(source: string): Token[] | null {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index];
    if (!character) return null;

    if (
      character === "+" ||
      character === "-" ||
      character === "*" ||
      character === "/"
    ) {
      const previous = tokens[tokens.length - 1];
      const unaryMinus =
        character === "-" && (!previous || previous.kind === "operator");
      if (unaryMinus) {
        const number = readNumber(source.slice(index + 1));
        if (!number) return null;
        tokens.push({ kind: "number", value: -number.value });
        index += 1 + number.length;
        continue;
      }
      if (!previous || previous.kind === "operator") return null;
      tokens.push({ kind: "operator", value: character });
      index += 1;
      continue;
    }

    const number = readNumber(source.slice(index));
    if (!number) return null;
    tokens.push({ kind: "number", value: number.value });
    index += number.length;
  }

  return tokens.length > 0 ? tokens : null;
}

function readNumber(source: string): { value: number; length: number } | null {
  const match = /^(?:\d+\.?\d*|\.\d+)/.exec(source);
  if (!match) return null;
  const value = Number(match[0]);
  if (!Number.isFinite(value)) return null;
  return { value, length: match[0].length };
}

function parseExpression(
  tokens: Token[],
  position = 0,
):
  | { ok: true; value: number; position: number }
  | { ok: false; message: string } {
  const left = parseTerm(tokens, position);
  if (!left.ok) return left;

  let value = left.value;
  let index = left.position;
  while (index < tokens.length) {
    const operator = tokens[index];
    if (operator?.kind !== "operator") break;
    if (operator.value !== "+" && operator.value !== "-") break;
    const right = parseTerm(tokens, index + 1);
    if (!right.ok) return right;
    value = operator.value === "+" ? value + right.value : value - right.value;
    index = right.position;
  }

  return { ok: true, value, position: index };
}

function parseTerm(
  tokens: Token[],
  position: number,
):
  | { ok: true; value: number; position: number }
  | { ok: false; message: string } {
  const left = parseFactor(tokens, position);
  if (!left.ok) return left;

  let value = left.value;
  let index = left.position;
  while (index < tokens.length) {
    const operator = tokens[index];
    if (operator?.kind !== "operator") break;
    if (operator.value !== "*" && operator.value !== "/") break;
    const right = parseFactor(tokens, index + 1);
    if (!right.ok) return right;
    if (operator.value === "/" && right.value === 0) {
      return { ok: false, message: divideByZeroMessage };
    }
    value = operator.value === "*" ? value * right.value : value / right.value;
    index = right.position;
  }

  return { ok: true, value, position: index };
}

function parseFactor(
  tokens: Token[],
  position: number,
):
  | { ok: true; value: number; position: number }
  | { ok: false; message: string } {
  const token = tokens[position];
  if (token?.kind !== "number") {
    return { ok: false, message: invalidMessage };
  }
  return { ok: true, value: token.value, position: position + 1 };
}
