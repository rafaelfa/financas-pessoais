import { ListFilter } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { RuleApplyDialog, type RulePreview } from '@/components/rule-apply-dialog';
import { RuleDialog } from '@/components/rule-dialog';
import { RuleList } from '@/components/rule-list';
import { Button } from '@/components/ui/button';
import { listAccounts } from '@/server/accounts';
import { listCards } from '@/server/cards';
import { listCategories } from '@/server/categories';
import { listRules, previewRules } from '@/server/rules';

export const metadata: Metadata = { title: 'Regras' };

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Regras de categorização automática.
 *
 * Duas peças separadas de propósito:
 *
 * - **Guardar** uma regra não categoriza nada (o formulário faz isso);
 * - **Aplicar** é um passo explícito, com pré-visualização. O diálogo abre por
 *   URL (`?prever=1`) porque `previewRules` é uma consulta de servidor e não
 *   pode ser chamada a partir do browser — o mesmo padrão do detalhe da fatura.
 */
export default async function RegrasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const wantsPreview = typeof params.prever === 'string';
  const canPreview = params.prever === undefined || params.prever === '' || params.prever === '1';

  const [rules, accounts, cards, categories] = await Promise.all([
    listRules(),
    listAccounts(),
    listCards(),
    listCategories(),
  ]);

  /*
   * A pré-visualização é uma consulta à parte: se falhar (ou se o URL for
   * adulterado), o ecrã continua a funcionar e o diálogo explica que não
   * conseguiu calcular nada — em vez de derrubar a página inteira.
   */
  let preview: RulePreview | null = null;

  if (wantsPreview && canPreview) {
    try {
      preview = await previewRules();
    } catch {
      preview = null;
    }
  }

  const invalidCount = rules.filter((rule) => !rule.isValid).length;
  const ordered = [...rules].sort((left, right) => left.priority - right.priority);
  const nextPriority =
    ordered.length === 0 ? 100 : Math.max(...ordered.map((rule) => rule.priority)) + 1;

  return (
    <>
      <PageHeader
        title="Regras"
        description="Categoriza automaticamente o que se repete: «sempre que a descrição tiver continente, é Alimentação». As condições de uma regra têm de se verificar todas, e a primeira regra da lista que corresponder ganha."
        actions={
          rules.length === 0 ? null : (
            <>
              <Button asChild variant="outline" size="sm" className="min-h-11 sm:min-h-8">
                <Link href="/regras?prever=1">Pré-visualizar e aplicar</Link>
              </Button>
              <RuleDialog
                mode="create"
                accounts={accounts}
                cards={cards}
                categories={categories}
                defaultPriority={nextPriority}
                trigger={<Button size="sm">Nova regra</Button>}
              />
            </>
          )
        }
      />

      {invalidCount > 0 ? (
        <p
          role="status"
          className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          {invalidCount === 1
            ? 'Há 1 regra sem condições. Não é usada nem pode ser ativada — edita-a para lhe dar pelo menos uma condição.'
            : `Há ${invalidCount} regras sem condições. Não são usadas nem podem ser ativadas — edita-as para lhes dar pelo menos uma condição.`}
        </p>
      ) : null}

      {rules.length === 0 ? (
        <EmptyState
          icon={ListFilter}
          title="Ainda não tens regras"
          description="Uma regra poupa-te trabalho: em vez de categorizares a EDP todos os meses, escreves «descrição contém EDP → Água, luz e gás» uma vez. Cada regra precisa de pelo menos uma condição — descrição, contraparte, valor, dia do mês, conta ou cartão — e nada é aplicado sem primeiro veres o que mudaria."
          action={
            <RuleDialog
              mode="create"
              accounts={accounts}
              cards={cards}
              categories={categories}
              defaultPriority={nextPriority}
              trigger={<Button size="sm">Criar a primeira regra</Button>}
            />
          }
        />
      ) : (
        <RuleList rules={rules} accounts={accounts} cards={cards} categories={categories} />
      )}

      {wantsPreview && canPreview ? <RuleApplyDialog preview={preview} /> : null}
    </>
  );
}
