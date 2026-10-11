'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signIn } from '@/lib/auth-client';

export default function EntrarPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErro(null);

    const { error } = await signIn.email({ email, password });

    if (error) {
      const mensagem =
        error.message === 'Invalid email or password'
          ? 'E-mail ou palavra-passe incorretos.'
          : (error.message ?? 'Não consegui entrar. Tenta outra vez.');

      setPending(false);
      setErro(mensagem);
      toast.error(mensagem);
      return;
    }

    toast.success('Entraste. Bem-vindo de volta.');
    router.push('/');
    router.refresh();
  }

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <CardHeader>
          <CardTitle as="h1">Entrar</CardTitle>
          <CardDescription>Acede às tuas contas, orçamento e objetivos.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/*
            O erro fica **no DOM**, e não só num `toast` que desaparece: um aviso
            efémero não é alcançável por quem chega ao formulário depois dele, e
            uma auditoria automática não tem o que analisar. É o requisito 3.3.1.
          */}
          {erro !== null && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {erro}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Palavra-passe</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'A entrar…' : 'Entrar'}
          </Button>
          <p className="text-sm text-muted-foreground">
            Ainda não tens conta?{' '}
            <Link
              href="/registar"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Criar conta
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
