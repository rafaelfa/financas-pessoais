import { prisma } from '@repo/db/client';
import { toDateInputValue } from '@repo/shared';

import { requireUser } from './session';

/**
 * Consultas de bens e dívidas.
 *
 * Não há cálculo nenhum aqui: o património líquido é do motor
 * (`netWorth.ts`, em `packages/shared`), que soma `valueInCents` dos bens e
 * `outstandingInCents` das dívidas. Esta camada só vai buscar as linhas do
 * utilizador e dá-lhes a forma que os formulários leem.
 */

export interface AssetView {
  readonly id: string;
  readonly type: 'VEHICLE' | 'PROPERTY' | 'OTHER';
  readonly name: string;
  readonly description: string | null;
  readonly valueInCents: number;
  readonly acquiredOn: string | null;
  readonly valuedOn: string | null;
  readonly archived: boolean;
}

export interface LiabilityView {
  readonly id: string;
  readonly type: 'LOAN' | 'MORTGAGE' | 'CREDIT_LINE' | 'OTHER';
  readonly name: string;
  readonly creditor: string | null;
  readonly principalInCents: number;
  readonly outstandingInCents: number;
  readonly interestRateBasisPoints: number | null;
  readonly totalInstallments: number | null;
  readonly remainingInstallments: number | null;
  readonly installmentAmountInCents: number | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly archived: boolean;
}

const dataOuNulo = (data: Date | null): string | null =>
  data === null ? null : toDateInputValue(data);

/** Bens do utilizador, dos mais recentes para os mais antigos. */
export async function listAssets(): Promise<AssetView[]> {
  const user = await requireUser();

  const assets = await prisma.asset.findMany({
    where: { userId: user.id },
    orderBy: [{ archivedAt: 'asc' }, { createdAt: 'desc' }],
  });

  return assets.map((asset) => ({
    id: asset.id,
    type: asset.type,
    name: asset.name,
    description: asset.description,
    valueInCents: asset.valueInCents,
    acquiredOn: dataOuNulo(asset.acquiredOn),
    valuedOn: dataOuNulo(asset.valuedOn),
    archived: asset.archivedAt !== null,
  }));
}

/** Dívidas do utilizador, com o mesmo critério de ordenação. */
export async function listLiabilities(): Promise<LiabilityView[]> {
  const user = await requireUser();

  const liabilities = await prisma.liability.findMany({
    where: { userId: user.id },
    orderBy: [{ archivedAt: 'asc' }, { createdAt: 'desc' }],
  });

  return liabilities.map((liability) => ({
    id: liability.id,
    type: liability.type,
    name: liability.name,
    creditor: liability.creditor,
    principalInCents: liability.principalInCents,
    outstandingInCents: liability.outstandingInCents,
    interestRateBasisPoints: liability.interestRateBasisPoints,
    totalInstallments: liability.totalInstallments,
    remainingInstallments: liability.remainingInstallments,
    installmentAmountInCents: liability.installmentAmountInCents,
    startDate: dataOuNulo(liability.startDate),
    endDate: dataOuNulo(liability.endDate),
    archived: liability.archivedAt !== null,
  }));
}
