'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * Wraps the app in `next-themes`.
 *
 * `attribute="class"` makes the provider toggle the `.dark` class on `<html>`,
 * which is exactly what the `@custom-variant dark (&:is(.dark *))` rule in
 * `globals.css` expects.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
