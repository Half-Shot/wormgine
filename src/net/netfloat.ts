/**
 * Specific type to
 */
export type NetworkFloat = { nf: true; e: string };

export function toNetworkFloat(v: number): NetworkFloat {
  return { nf: true, e: v.toExponential() };
}

export function fromNetworkFloat(v: NetworkFloat): number {
  return Number(v.e);
}

export function toNetObject(
  o: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(o).map<[string, unknown]>(([key, v]) => {
      if (typeof v === "number" && !Number.isInteger(v)) {
        return [key, toNetworkFloat(v)];
      } else if (Array.isArray(v)) {
        return [
          key,
          v.map((v2) =>
            typeof v2 === "number" && !Number.isInteger(v2)
              ? toNetworkFloat(v2)
              : v2,
          ),
        ];
      } else if (typeof v === "object") {
        return [key, toNetObject(v as Record<string, unknown>)];
      }
      return [key, v];
    }),
  );
}

export function fromNetObject(o: Record<string, unknown>): unknown {
  function isNF(v: unknown): v is NetworkFloat {
    return (
      (v !== null && typeof v === "object" && "nf" in v && v.nf === true) ||
      false
    );
  }

  return Object.fromEntries(
    Object.entries(o).map<[string, unknown | NetworkFloat]>(([key, v]) => {
      if (isNF(v)) {
        return [key, fromNetworkFloat(v)];
      } else if (Array.isArray(v)) {
        return [key, v.map((v2) => (isNF(v2) ? fromNetworkFloat(v2) : v2))];
      } else if (typeof v === "object") {
        return [key, fromNetObject(v as Record<string, unknown>)];
      }
      return [key, v];
    }),
  );
}
