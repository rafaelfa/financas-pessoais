'use client';

import * as React from 'react';
import {
  Controller,
  FormProvider,
  type Control,
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';

export const Form = FormProvider;

/** Erro do campo em curso, para o `FormMessage` o mostrar sem props. */
const FormFieldContext = React.createContext<{ error?: string }>({});

/** Envolve o campo e ocupa o lugar onde o erro de validação aparece. */
export function FormControl({ children, ...props }: React.ComponentProps<'div'>) {
  return <div {...props}>{children}</div>;
}

export function FormField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  render,
}: {
  control?: Control<TFieldValues>;
  name: TName;
  render: (props: {
    field: ControllerRenderProps<TFieldValues, TName>;
    fieldState: ControllerFieldState;
  }) => React.ReactElement;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <FormFieldContext.Provider value={{ error: fieldState.error?.message }}>
          {render({ field, fieldState })}
        </FormFieldContext.Provider>
      )}
    />
  );
}

export function FormItem({ children, className }: React.ComponentProps<'div'>) {
  return <div className={className}>{children}</div>;
}

export function FormLabel({ children, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      {...props}
    >
      {children}
    </label>
  );
}

export function FormDescription({ children }: React.ComponentProps<'p'>) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export function FormMessage({ children }: React.ComponentProps<'p'>) {
  const { error } = React.useContext(FormFieldContext);
  const message = children ?? error;

  if (message === undefined || message === null || message === '') {
    return null;
  }

  return <p className="text-sm font-medium text-destructive">{message}</p>;
}
