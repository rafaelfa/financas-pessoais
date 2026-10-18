'use client';

import * as React from 'react';

export const Form = ({ children }: React.ComponentProps<'form'>) => <form>{children}</form>;

export function FormControl({ children }: React.ComponentProps<'div'>) {
  return <div>{children}</div>;
}

export function FormField({ name, render }: { name: string; render: (props: { field: any }) => React.ReactElement }) {
  const [value, setValue] = React.useState('');
  return render({ field: { name, value, onChange: (v: string) => setValue(v) } });
}

export function FormItem({ children, className }: React.ComponentProps<'div'>) {
  return <div className={className}>{children}</div>;
}

export function FormLabel({ children }: React.ComponentProps<'label'>) {
  return <label className="text-sm font-medium">{children}</label>;
}

export function FormDescription({ children }: React.ComponentProps<'p'>) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export function FormMessage({ children }: React.ComponentProps<'p'>) {
  return <p className="text-sm text-destructive">{children}</p>;
}
