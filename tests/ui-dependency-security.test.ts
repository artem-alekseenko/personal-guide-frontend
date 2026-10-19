import { expect, it } from "vitest";
import braces from "braces";
import forge from "node-forge";

// Public-only vectors from digitalbazaar/forge's RSA tests and PR #1152.
// No private key material or application credentials are used.
const modulus =
  "E932AC92252F585B3A80A4DD76A897C8B7652952FE788F6EC8DD640587A1EE56" +
  "47670A8AD4C2BE0F9FA6E49C605ADF77B5174230AF7BD50E5D6D6D6D28CCF0A8" +
  "86A514CC72E51D209CC772A52EF419F6A953F3135929588EBE9B351FCA61CED7" +
  "8F346FE00DBB6306E5C2A4C6DFC3779AF85AB417371CF34D8387B9B30AE46D7A" +
  "5FF5A655B8D8455F1B94AE736989D60A6F2FD5CADBFFBD504C5A756A2E6BB5CE" +
  "CC13BCA7503F6DF8B52ACE5C410997E98809DB4DC30D943DE4E812A47553DCE5" +
  "4844A78E36401D13F77DC650619FED88D8B3926E3D8E319C80C744779AC5D6AB" +
  "E252896950917476ECE5E8FC27D5F053D6018D91B502C4787558A002B9283DA7";
const nestedGarbageSignature =
  "a4ae63dd5e7712b78f4870d0f51e294df5503d4f16c5d27ae33370981fb57f0de49f" +
  "50f3d6a04666774cd984cd13972db9bf8e12bd294ef0ddc916c7c86cbae63efd7b6b" +
  "97885e69760c208a40f1aecc76a90d7af5145177efce1bb55807a8d05c20b1596753" +
  "ba710642fc9acdde6c160232654662c77cc4466c8257a38edb49f894e8845d0fd987" +
  "b857ced88f4b62505a080bd87ef700d35d392a6e8f6fde34250c50b86fae606cb551" +
  "215e8f4813239b77651d5565ad453698c071d48c31e8e526fb4a37610f64b3e1fb8e" +
  "5be5898e408ad08197a0947794a530b54f84485377ce4a7488ed485ce4e5e105dd89" +
  "698a472f390c3b1b76bc16b73276c4d1c81d";

it("rejects RSA DigestAlgorithm garbage instead of accepting a low-exponent forgery", () => {
  const key = forge.pki.rsa.setPublicKey(
    new forge.jsbn.BigInteger(modulus, 16),
    new forge.jsbn.BigInteger("3"),
  );
  const digest = forge.md.sha256
    .create()
    .update("hello world!")
    .digest()
    .getBytes();
  expect(() =>
    key.verify(digest, forge.util.hexToBytes(nestedGarbageSignature)),
  ).toThrow();
});

it("still verifies a valid RSA signature and rejects a different message", () => {
  const key = forge.pki.publicKeyFromPem(
    "-----BEGIN PUBLIC KEY-----\n" +
      "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDL0EugUiNGMWscLAVM0VoMdhDZ\n" +
      "EJOqdsUMpx9U0YZI7szokJqQNIwokiQ6EonNnWSMlIvy46AhnlRYn+ezeTeU7eMG\n" +
      "TkP3VF29vXBo+dLq5e+8VyAyQ3FzM1wI4ts4hRACF8w6mqygXQ7i/SDu8/rXqRGt\n" +
      "vnM+z0MYDdKo80efzwIDAQAB\n-----END PUBLIC KEY-----\n",
  );
  const signature = forge.util.hexToBytes(
    "9200ece65cdaed36bcc20b94c65af852e4f88f0b4fe5b249d54665f815992ac4" +
      "3a1399e65d938c6a7f16dd39d971a53ca66523209dbbfbcb67afa579dbb0c220" +
      "672813d9e6f4818f29b9becbb29da2032c5e422da97e0c39bfb7a2e7d568615a" +
      "5073af0337ff215a8e1b2332d668691f4fb731440055420c24ac451dd3c913f4",
  );
  expect(
    key.verify(
      forge.md.sha1.create().update("0123456789abcdef").digest().getBytes(),
      signature,
    ),
  ).toBe(true);
  expect(
    key.verify(
      forge.md.sha1.create().update("different message").digest().getBytes(),
      signature,
    ),
  ).toBe(false);
});

interface BraceNode {
  type: string;
  value?: string;
  nodes?: BraceNode[];
  parent?: BraceNode;
}
// @types/braces omits the documented AST entry points and AST overload of expand.
const braceAstApi = braces as typeof braces & {
  compile: (ast: BraceNode) => string;
  expand: (ast: BraceNode) => string[];
  stringify: (ast: BraceNode) => string;
};

it("rejects excessive pattern nesting below the existing character limit", () => {
  const pattern = "{".repeat(4000) + "a,b" + "}".repeat(4000);
  expect(() => braces(pattern)).toThrow(SyntaxError);
});

it.each(["compile", "expand", "stringify"] as const)(
  "bounds the %s walker when an AST bypasses string parsing",
  (method) => {
    const ast: BraceNode = { type: "root", nodes: [] };
    let parent = ast;
    for (let i = 0; i < 4000; i++) {
      const child: BraceNode = { type: "paren", nodes: [], parent };
      parent.nodes!.push(child);
      parent = child;
    }
    parent.nodes!.push({ type: "text", value: "x", parent });
    expect(() => braceAstApi[method](ast)).toThrow(SyntaxError);
  },
);

it("preserves supported nested alternatives at the nesting boundary", () => {
  const prefix = "{".repeat(99);
  const suffix = "}".repeat(99);
  expect(braces.expand(prefix + "{a,b}" + suffix)).toEqual([
    prefix + "a" + suffix,
    prefix + "b" + suffix,
  ]);
  expect(() => braces("{" + prefix + "{a,b}" + suffix + "}")).toThrow(
    SyntaxError,
  );
});

it("does not count escaped or quoted literal braces as AST nesting", () => {
  const literal = "{".repeat(1000) + "x" + "}".repeat(1000);
  const escaped = "\\{".repeat(1000) + "x" + "\\}".repeat(1000);
  expect(braces.expand(escaped)).toEqual([literal]);
  expect(braces.expand('"' + literal + '"')).toEqual([literal]);
});
