'use client';

import { Archive, ArchiveRestore, Gem, Pencil, Receipt, Trash } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Amount } from '@/components/amount';
import { ASSET_TYPE_LABELS, AssetDialog } from '@/components/asset-dialog';
import { LIABILITY_TYPE_LABELS, LiabilityDialog } from '@/components/liability-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { setAssetArchived, setLiabilityArchived } from '@/server/patrimonio-actions';
import type { AssetView, LiabilityView } from '@/server/patrimonio';

/**
 * Bens e dívidas.
 *
 * Arquivar em vez de apagar: um bem vendido ou uma dívida paga saem do
 * património, mas a linha fica — o histórico não se reescreve. Os arquivados
 * aparecem numa lista separada, com a opção de reativar.
 */

type Alvo = { tipo: 'bem'; item: AssetView } | { tipo: 'divida'; item: LiabilityView };

export function PatrimonioList({
  assets,
  liabilities,
}: {
  readonly assets: readonly AssetView[];
  readonly liabilities: readonly LiabilityView[];
}) {
  const [editingAsset, setEditingAsset] = useState<AssetView | null>(null);
  const [editingLiability, setEditingLiability] = useState<LiabilityView | null>(null);
  const [arquivar, setArquivar] = useState<Alvo | null>(null);
  const [pending, startTransition] = useTransition();

  const ativos = assets.filter((asset) => !asset.archived);
  const arquivados = assets.filter((asset) => asset.archived);
  const dividasAtivas = liabilities.filter((liability) => !liability.archived);
  const dividasArquivadas = liabilities.filter((liability) => liability.archived);

  function confirmarArquivo() {
    if (arquivar === null) {
      return;
    }

    const alvo = arquivar;

    startTransition(async () => {
      const result =
        alvo.tipo === 'bem'
          ? await setAssetArchived({ id: alvo.item.id, archived: true })
          : await setLiabilityArchived({ id: alvo.item.id, archived: true });

      if (!result.ok) {
        toast.error(result.error);
        setArquivar(null);
        return;
      }

      toast.success(alvo.tipo === 'bem' ? 'Bem arquivado.' : 'Dívida arquivada.');
      setArquivar(null);
    });
  }

  function reativar(alvo: Alvo) {
    startTransition(async () => {
      const result =
        alvo.tipo === 'bem'
          ? await setAssetArchived({ id: alvo.item.id, archived: false })
          : await setLiabilityArchived({ id: alvo.item.id, archived: false });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(alvo.tipo === 'bem' ? 'Bem reativado.' : 'Dívida reativada.');
    });
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="bens" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="bens" className="font-heading text-lg font-medium">
            Bens
          </h2>
          <AssetDialog mode="create" trigger={<Button size="sm">Novo bem</Button>} />
        </div>

        {ativos.length === 0 ? (
          <EmptyState
            icon={Gem}
            title="Ainda não tens bens registados"
            description="Uma casa, um carro ou outra coisa de valor entram aqui pelo valor que lhes deres hoje."
            action={<AssetDialog mode="create" trigger={<Button size="sm">Registar bem</Button>} />}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {ativos.map((asset) => (
              <Card key={asset.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="truncate">{asset.name}</CardTitle>
                      <Badge variant="secondary">
                        {ASSET_TYPE_LABELS[asset.type] ?? asset.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingAsset(asset)}
                        aria-label={`Editar ${asset.name}`}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setArquivar({ tipo: 'bem', item: asset })}
                        aria-label={`Arquivar ${asset.name}`}
                      >
                        <Archive className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-lg font-semibold">
                    <Amount amountInCents={asset.valueInCents} tone="neutral" />
                  </div>
                  {asset.description === null || asset.description.trim() === '' ? null : (
                    <p className="text-sm text-muted-foreground">{asset.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {asset.valuedOn === null
                      ? 'Sem data de avaliação'
                      : `Avaliado em ${asset.valuedOn}`}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {arquivados.length > 0 ? (
          <details className="rounded-xl border bg-muted/30 p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Bens arquivados ({arquivados.length})
            </summary>
            <ul className="mt-3 space-y-2 text-sm">
              {arquivados.map((asset) => (
                <li key={asset.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-muted-foreground">{asset.name}</span>
                  <span className="flex items-center gap-2">
                    <Amount amountInCents={asset.valueInCents} tone="neutral" />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => reativar({ tipo: 'bem', item: asset })}
                    >
                      <ArchiveRestore className="mr-1 h-4 w-4" aria-hidden />
                      Reativar
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section aria-labelledby="dividas" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="dividas" className="font-heading text-lg font-medium">
            Dívidas
          </h2>
          <LiabilityDialog mode="create" trigger={<Button size="sm">Nova dívida</Button>} />
        </div>

        {dividasAtivas.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Ainda não tens dívidas registadas"
            description="Um empréstimo ou um crédito entra aqui pelo que ainda deves, não pelo que pediste."
            action={
              <LiabilityDialog mode="create" trigger={<Button size="sm">Registar dívida</Button>} />
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {dividasAtivas.map((liability) => (
              <Card key={liability.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="truncate">{liability.name}</CardTitle>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary">
                          {LIABILITY_TYPE_LABELS[liability.type] ?? liability.type}
                        </Badge>
                        {liability.creditor === null ? null : (
                          <Badge variant="outline">{liability.creditor}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingLiability(liability)}
                        aria-label={`Editar ${liability.name}`}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setArquivar({ tipo: 'divida', item: liability })}
                        aria-label={`Arquivar ${liability.name}`}
                      >
                        <Archive className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-lg font-semibold">
                    <Amount amountInCents={liability.outstandingInCents} tone="neutral" />
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      em dívida
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <dt>Capital inicial</dt>
                    <dd className="text-right">
                      <Amount amountInCents={liability.principalInCents} tone="neutral" />
                    </dd>
                    {liability.interestRateBasisPoints === null ? null : (
                      <>
                        <dt>Taxa anual</dt>
                        <dd className="text-right">
                          {(liability.interestRateBasisPoints / 100).toFixed(2).replace('.', ',')} %
                        </dd>
                      </>
                    )}
                    {liability.remainingInstallments === null ? null : (
                      <>
                        <dt>Prestações a faltar</dt>
                        <dd className="text-right">
                          {liability.remainingInstallments}
                          {liability.totalInstallments === null
                            ? ''
                            : ` de ${liability.totalInstallments}`}
                        </dd>
                      </>
                    )}
                    {liability.endDate === null ? null : (
                      <>
                        <dt>Fim</dt>
                        <dd className="text-right">{liability.endDate}</dd>
                      </>
                    )}
                  </dl>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {dividasArquivadas.length > 0 ? (
          <details className="rounded-xl border bg-muted/30 p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Dívidas arquivadas ({dividasArquivadas.length})
            </summary>
            <ul className="mt-3 space-y-2 text-sm">
              {dividasArquivadas.map((liability) => (
                <li key={liability.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-muted-foreground">{liability.name}</span>
                  <span className="flex items-center gap-2">
                    <Amount amountInCents={liability.outstandingInCents} tone="neutral" />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => reativar({ tipo: 'divida', item: liability })}
                    >
                      <ArchiveRestore className="mr-1 h-4 w-4" aria-hidden />
                      Reativar
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {editingAsset === null ? null : (
        <AssetDialog
          mode="edit"
          asset={editingAsset}
          open
          onOpenChange={(aberto) => {
            if (!aberto) {
              setEditingAsset(null);
            }
          }}
        />
      )}

      {editingLiability === null ? null : (
        <LiabilityDialog
          mode="edit"
          liability={editingLiability}
          open
          onOpenChange={(aberto) => {
            if (!aberto) {
              setEditingLiability(null);
            }
          }}
        />
      )}

      <AlertDialog
        open={arquivar !== null}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setArquivar(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash aria-hidden />
            </AlertDialogMedia>
            <AlertDialogTitle>
              Arquivar {arquivar?.tipo === 'divida' ? 'a dívida' : 'o bem'} «{arquivar?.item.name}»?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sai do património líquido e da lista. A linha não é apagada — podes reativar mais
              tarde, na lista dos arquivados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                confirmarArquivo();
              }}
            >
              {pending ? 'A arquivar…' : 'Arquivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
