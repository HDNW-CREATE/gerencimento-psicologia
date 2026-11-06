import * as React from 'react';
import { cn } from '@/lib/utils';

const baseField =
  'flex w-full rounded-lg border border-input bg-card px-3.5 py-2 text-base text-foreground shadow-sm transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-destructive';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input type={type} className={cn(baseField, 'h-11', className)} ref={ref} {...props} />
  ),
);
Input.displayName = 'Input';

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea className={cn(baseField, 'min-h-[96px]', className)} ref={ref} {...props} />
));
Textarea.displayName = 'Textarea';

/** <select> nativo estilizado: melhor acessibilidade e UX no celular do que um dropdown customizado. */
const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select className={cn(baseField, 'h-11 appearance-auto', className)} ref={ref} {...props}>
    {children}
  </select>
));
NativeSelect.displayName = 'NativeSelect';

export { Input, Textarea, NativeSelect };
