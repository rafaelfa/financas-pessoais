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
import { signUp } from '@/lib/auth-client';

export default function RegistarPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErro(null);

    const { error } = await signUp.email({ name, email, password });

    if (error) {
      const mensagem =
        error.message === 'User already exists'
          ? 'Já existe uma conta com este e-mail.'
          : (error.message ?? 'Não consegui criar a conta. Tenta outra vez.');

      setPending(false);
      setErro(mensagem);
      toast.error(mensagem);
      return;
    }

    toast.success('Conta criada. Entra com os teus dados.');
    router.push('/entrar');
    router.refresh();
  }

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <CardHeader>
          <CardTitle as="h1">Criar conta</CardTitle>
          <CardDescription>
            Uma conta só para ti. Os teus dados ficam isolados e nunca são partilhados.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Ver `entrar/page.tsx`: o erro tem de ficar no DOM, não só num toast. */}
          {erro !== null && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {erro}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              autoComplete="name"
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby="password-ajuda"
            />
            <p id="password-ajuda" className="text-xs text-muted-foreground">
              Pelo menos 8 caracteres. Uma frase longa é mais segura do que uma palavra curta com
              símbolos.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'A criar…' : 'Criar conta'}
          </Button>
          <p className="text-sm text-muted-foreground">
            Já tens conta?{' '}
            <Link
              href="/entrar"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Entrar
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
