import { Skeleton } from '@/components/ui/skeleton';

/**
 * Esqueleto de `/` (T76/F3).
 *
 * As duas caixas são medidas, não estimadas: o cabeçalho ocupa 120 px a 390 e
 * 60 px a 1440, e o primeiro bloco 144 px e 116 px. É essa altura fixa
 * que impede o conteúdo de saltar quando os dados chegam (CLS 0 aos dois ecrãs).
 */
export default function Loading() {
  return (
    <>
      <span role="status" className="sr-only">
        A carregar…
      </span>
      <div aria-hidden>
        <div className="mb-6 flex h-[120px] flex-col justify-center gap-2 sm:h-[60px]">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Skeleton className="h-[144px] rounded-xl sm:h-[116px]" />
      </div>
    </>
  );
}
