/**
 * Resolvedor mínimo para correr as fontes TypeScript do `@repo/shared` em Node.
 *
 * Os imports internos do pacote são relativos e sem extensão (`./csv`,
 * `../finance/rules`), o que o carregador ESM do Node não resolve sozinho. Este
 * *hook* acrescenta `.ts` e `index.ts` a esses especificadores — é o mesmo método
 * que o §5 de `docs/spec/T3.3-verificacao-camada-dados.md` documentou para esta
 * máquina, onde o `tsx` e o `vitest` falham com `spawn EPERM`.
 */

/** Especificador relativo sem extensão conhecida? */
function semExtensao(specifier) {
  return specifier.startsWith('.') && !/\.(?:[cm]?[jt]sx?|json|node)$/.test(specifier);
}

export async function resolve(specifier, context, next) {
  if (semExtensao(specifier)) {
    try {
      return await next(`${specifier}.ts`, context);
    } catch {
      try {
        return await next(`${specifier}/index.ts`, context);
      } catch {
        // Deixa o erro original decidir: não se esconde uma resolução falhada.
      }
    }
  }

  return next(specifier, context);
}
