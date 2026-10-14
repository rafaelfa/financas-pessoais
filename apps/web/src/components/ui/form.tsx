'use client';

import * as React from 'react';
import { Controller, FormProvider, type UseFormReturn } from 'react-hook-form';

export const Form = FormProvider;

export function FormControl({ children, name, ...props }: React.ComponentProps<'div'> & { name?: string }) {
  return (
    <Controller
      name={name || ''}
      render={({ field }) => <div {...props}>{children}</div>}
    />
  );
}

export function FormField({
  control,
  name,
  render,
}: {
  control?: UseFormReturn<any>['control'];
  name: string;
  render: (props: { field: any; fieldState: { error?: { message?: string } } }) => React.ReactElement;
}) {
  const [formState] = React.useState({ errors: {} as Record<string, { message?: string }> });

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => render({ field, fieldState })}
    />
  );
}

export function FormItem({ children, className }: React.ComponentProps<'div'>) {
  return <div className={className}>{children}</div>;
}

export function FormLabel({ children }: React.ComponentProps<'label'>) {
  return <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{children}</label>;
}

export function FormDescription({ children }: React.ComponentProps<'p'>) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export function FormMessage({ children }: React.ComponentProps<'p'>) {
  return <p className="text-sm font-medium text-destructive">{children}</p>;
}
